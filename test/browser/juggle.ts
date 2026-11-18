import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test as base, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import type {Name} from '../../src/shared/api';

// The browser tests run against one of two Juggles, named by JUGGLE_TARGET:
// "local" (the default, and the safe one) starts a Juggle on this laptop for
// each test, and "beta" drives the beta copy on Cloudflare through real
// Access. Either way each test starts from an empty database of its own.
// `as(email)` opens Juggle in a browser of its own, signed in as that Person.
export const target = process.env.JUGGLE_TARGET ?? 'local';
if (target !== 'local' && target !== 'beta') throw new Error(`JUGGLE_TARGET must be "local" or "beta", not "${target}"`);

// Opens Juggle as the Person with this email. Unless a test asks for a
// Person with no name yet, they are named for their role, such as user-1.
type As = (email: string, name?: Name) => Promise<Page>;
const roleName = (email: string): Name => ({kind: 'given', text: email.split('@')[0]});

// Every test Juggle on the laptop keeps its data in a folder named with this.
export const testFolderPrefix = 'juggle-test-';

export const test = base.extend<{as: As}>({
	as: async ({browser, contextOptions}, use) => {
		// Every browser a test opens is closed when it ends, before its Juggle
		// is emptied or stopped. A page left open stays signed in and live, so
		// it would keep hearing and fetching for every later test.
		const opened: BrowserContext[] = [];
		const closeAll = () => Promise.all(opened.map((context) => context.close()));
		if (target === 'beta') {
			try {
				await use(await onBeta(browser, contextOptions, opened));
			} finally {
				await closeAll();
				emptyBetaDatabase();
			}
		}
		else await onLaptop(browser, contextOptions, opened, closeAll, use);
	},
});

export {expect};

// Waits for the page to finish what the last action started.
export async function settled(page: Page) {
	await expect(page.locator('html[data-settled="true"]')).toBeAttached();
}

async function open(browser: Browser, options: object, opened: BrowserContext[], url: string, signIn: {cookie: string} | {clientId: string; clientSecret: string}, name: Name): Promise<Page> {
	const context = await browser.newContext({
		...options,
		baseURL: url,
		extraHTTPHeaders: 'clientId' in signIn ? {'CF-Access-Client-Id': signIn.clientId, 'CF-Access-Client-Secret': signIn.clientSecret} : {},
	});
	opened.push(context);
	if ('cookie' in signIn) await context.addCookies([{name: 'juggle_local_email', value: signIn.cookie, url}]);
	if (name.kind === 'given') {
		const given = await context.request.put('/api/me/name', {data: {name: name.text}});
		if (!given.ok()) throw new Error(`Giving the name ${name.text} answered ${given.status()}`);
	}
	const page = await context.newPage();
	await page.goto('/');
	await settled(page);
	return page;
}

async function onLaptop(browser: Browser, options: object, opened: BrowserContext[], closeAll: () => Promise<unknown>, use: (as: As) => Promise<void>) {
	const state = mkdtempSync(join(tmpdir(), testFolderPrefix));
	let server: ReturnType<typeof spawn> | undefined;
	// Whatever happens, even when the test or the server fails, the server is
	// stopped and its data thrown away.
	try {
		run(['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state, '-c', 'wrangler.example.jsonc']);
		// Port 0 lets Vite take any free port itself, so no other process can
		// claim it between choosing it and starting; the port is read from what Vite prints.
		const started = spawn('npx', ['vite', '--port', '0', '--strictPort'], {
			env: {...process.env, JUGGLE_LOCAL_STATE: state, NO_COLOR: '1', FORCE_COLOR: '0'},
			detached: true,
		});
		server = started;
		const port = await new Promise<string>((resolve, reject) => {
			let errors = '';
			started.stdout!.on('data', (chunk: Buffer) => {
				const local = /Local:\s+http:\/\/localhost:(\d+)/.exec(chunk.toString());
				if (local) resolve(local[1]);
			});
			started.stderr!.on('data', (chunk: Buffer) => (errors += chunk.toString()));
			started.on('exit', (code) => reject(new Error(`vite stopped with ${code}: ${errors}`)));
		});
		await use((email, name = roleName(email)) => open(browser, options, opened, `http://localhost:${port}`, {cookie: email}, name));
	} finally {
		await closeAll();
		if (server?.pid !== undefined && server.exitCode === null) {
			const stopped = new Promise((resolve) => server!.once('exit', resolve));
			process.kill(-server.pid);
			await stopped;
		}
		rmSync(state, {recursive: true, force: true});
	}
}

// beta-tokens.json, which git ignores, holds beta's address and the service
// token each test Person signs in with.
type BetaTokens = {url: string; people: Record<string, {clientId: string; clientSecret: string}>};

async function onBeta(browser: Browser, options: object, opened: BrowserContext[]): Promise<As> {
	const beta = JSON.parse(readFileSync('beta-tokens.json', 'utf8')) as BetaTokens;
	emptyBetaDatabase();
	return (email, name = roleName(email)) => {
		const token = beta.people[email];
		if (!token) throw new Error(`beta-tokens.json has no service token for ${email}`);
		return open(browser, options, opened, beta.url, token, name);
	};
}

// The tables beta's tests write to.
export function betaTables(): string[] {
	const listed = run(['wrangler', 'd1', 'execute', 'DB', '--remote', '-c', 'wrangler.beta.jsonc', '--json', '--command',
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'"]);
	return (JSON.parse(listed) as {results: {name: string}[]}[])[0].results.map((row) => row.name);
}

// Beta's database only ever holds test data, so each test empties it before
// it starts and again when it ends, leaving nothing behind.
function emptyBetaDatabase() {
	const tables = betaTables();
	if (tables.length === 0) return;
	run(['wrangler', 'd1', 'execute', 'DB', '--remote', '-c', 'wrangler.beta.jsonc', '--command',
		['PRAGMA defer_foreign_keys = ON', ...tables.map((name) => `DELETE FROM "${name}"`)].join('; ')]);
}

export function run(args: string[]): string {
	const result = spawnSync('npx', args, {encoding: 'utf8'});
	if (result.status !== 0) throw new Error(`npx ${args.slice(0, 4).join(' ')} failed: ${result.stderr}`);
	return result.stdout;
}

