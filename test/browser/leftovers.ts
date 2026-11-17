import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {betaTables, run, target, testFolderPrefix} from './juggle';

// Runs once after every browser test has finished, and fails the run if any
// test left something behind, so the next run finds things as this one did.
export default function checkNothingIsLeft() {
	const left: string[] = [];

	const folders = readdirSync(tmpdir()).filter((name) => name.startsWith(testFolderPrefix));
	if (folders.length > 0) left.push(`test data folders in ${tmpdir()}: ${folders.join(', ')}`);

	// A test Juggle is the only thing started as `vite --port <n> --strictPort`.
	const servers = runningTestServers();
	if (servers.length > 0) left.push(`test Juggles still running: ${servers.join('; ')}`);

	if (target === 'beta') {
		for (const table of betaTables()) {
			const counted = run(['wrangler', 'd1', 'execute', 'DB', '--remote', '-c', 'wrangler.beta.jsonc', '--json', '--command', `SELECT COUNT(*) AS n FROM "${table}"`]);
			const n = (JSON.parse(counted) as {results: {n: number}[]}[])[0].results[0].n;
			if (n > 0) left.push(`${n} rows in beta's ${table} table`);
		}
	}

	if (left.length > 0) throw new Error(`The tests left things behind:\n${left.join('\n')}`);
}

function runningTestServers(): string[] {
	try {
		return execFileSync('pgrep', ['-fl', 'vite --port [0-9]+ --strictPort'], {encoding: 'utf8'}).trim().split('\n');
	} catch {
		// pgrep exits with 1 when nothing matches.
		return [];
	}
}
