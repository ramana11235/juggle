import {env, exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import {firstLink, type Message} from '../src/shared/api';
import {onlyFrom, previewOfPage} from '../src/worker/previews';
import {linkPreview} from '../src/worker/store';

function as(email: string) {
	return (path: string, init: RequestInit = {}) =>
		exports.default.fetch(`http://juggle.test${path}`, {...init, headers: {...init.headers, Cookie: `juggle_local_email=${email}`}});
}
type Ask = ReturnType<typeof as>;

async function startThread(ask: Ask): Promise<string> {
	const id = crypto.randomUUID();
	await ask('/api/threads', {method: 'POST', body: JSON.stringify({id, title: 'Free will'})});
	return id;
}
const send = async (ask: Ask, threadId: string, body: string) =>
	(await (await ask(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify({id: crypto.randomUUID(), body})})).json()) as Message;
const removePreview = (ask: Ask, threadId: string, id: string) => ask(`/api/threads/${threadId}/messages/${id}/preview`, {method: 'DELETE'});
const messages = async (ask: Ask, threadId: string) => (await (await ask(`/api/threads/${threadId}/messages`)).json()) as Message[];

const page = (head: string) => new Response(`<!doctype html><html><head>${head}</head><body>Hello</body></html>`, {headers: {'Content-Type': 'text/html'}});

describe('The first link in a Message', () => {
	it('is the first web address in its words', () => {
		expect(firstLink('Watch https://www.youtube.com/watch?v=abc and https://example.org')).toEqual({kind: 'link', url: 'https://www.youtube.com/watch?v=abc'});
	});

	it('leaves out the punctuation that ends a sentence or a Markdown link', () => {
		expect(firstLink('See (https://example.org/a).')).toEqual({kind: 'link', url: 'https://example.org/a'});
		expect(firstLink('[the entry](https://plato.stanford.edu/entries/compatibilism/)')).toEqual({kind: 'link', url: 'https://plato.stanford.edu/entries/compatibilism/'});
	});

	it('is none when the words have no web address', () => {
		expect(firstLink('Free means uncaused. www.example.org')).toEqual({kind: 'none'});
	});
});

describe('A page\'s preview', () => {
	it('is its Open Graph picture, title and site', async () => {
		const found = await previewOfPage(
			'https://www.youtube.com/watch?v=abc',
			page('<meta property="og:site_name" content="YouTube"><meta property="og:title" content="Me &amp; free will"><meta property="og:image" content="https://i.ytimg.com/vi/abc/hq.jpg">'),
		);
		expect(found).toEqual({kind: 'found', site: 'YouTube', title: 'Me & free will', image: {kind: 'image', url: 'https://i.ytimg.com/vi/abc/hq.jpg'}});
	});

	it('falls back to the page\'s title and address, and finds a picture given relative to the page', async () => {
		const found = await previewOfPage('https://www.example.org/notes/free', page('<title>Notes on free will</title><meta property="og:image" content="/cover.png">'));
		expect(found).toEqual({kind: 'found', site: 'example.org', title: 'Notes on free will', image: {kind: 'image', url: 'https://www.example.org/cover.png'}});
	});

	it('has no picture when the page gives none, or one that is not on the web', async () => {
		const found = await previewOfPage('https://example.org', page('<meta property="og:title" content="Notes"><meta property="og:image" content="javascript:alert(1)">'));
		expect(found).toEqual({kind: 'found', site: 'example.org', title: 'Notes', image: {kind: 'none'}});
	});

	it('is none for a page with no title, one that is not a web page, or one that failed', async () => {
		expect(await previewOfPage('https://example.org', page('<meta name="description" content="x">'))).toEqual({kind: 'none'});
		expect(await previewOfPage('https://example.org/a.pdf', new Response('%PDF', {headers: {'Content-Type': 'application/pdf'}}))).toEqual({kind: 'none'});
		expect(await previewOfPage('https://example.org', new Response('gone', {status: 404, headers: {'Content-Type': 'text/html'}}))).toEqual({kind: 'none'});
	});
});

describe('Previews are kept', () => {
	it('so each link\'s page is fetched once', async () => {
		const fetched: string[] = [];
		const fetchPage = async (url: string) => {
			fetched.push(url);
			return page('<meta property="og:title" content="Compatibilism">');
		};
		const first = await linkPreview(env.DB, 'https://plato.stanford.edu/entries/compatibilism/', fetchPage, 1000);
		const again = await linkPreview(env.DB, 'https://plato.stanford.edu/entries/compatibilism/', fetchPage, 2000);
		expect([first, again, fetched.length]).toEqual([
			{kind: 'found', site: 'plato.stanford.edu', title: 'Compatibilism', image: {kind: 'none'}},
			{kind: 'found', site: 'plato.stanford.edu', title: 'Compatibilism', image: {kind: 'none'}},
			1,
		]);
	});

	it('including that a page has none', async () => {
		let fetched = 0;
		const plain = async () => {
			fetched += 1;
			return page('<meta name="description" content="x">');
		};
		await linkPreview(env.DB, 'https://example.org/plain', plain, 1000);
		expect(await linkPreview(env.DB, 'https://example.org/plain', plain, 2000)).toEqual({kind: 'none'});
		expect(fetched).toBe(1);
	});

	it('but not that a page could not be reached or failed, so it is tried again', async () => {
		const answers: (() => Promise<Response>)[] = [
			async () => {
				throw new Error('could not connect');
			},
			async () => new Response('busy', {status: 503, headers: {'Content-Type': 'text/html'}}),
			async () => page('<meta property="og:title" content="Back again">'),
		];
		const flaky = () => answers.shift()!();
		expect(await linkPreview(env.DB, 'https://flaky.example', flaky, 1000)).toEqual({kind: 'none'});
		expect(await linkPreview(env.DB, 'https://flaky.example', flaky, 2000)).toEqual({kind: 'none'});
		expect(await linkPreview(env.DB, 'https://flaky.example', flaky, 3000)).toEqual({kind: 'found', site: 'flaky.example', title: 'Back again', image: {kind: 'none'}});
	});
});

describe('Fetching only from one origin', () => {
	it('finds no page anywhere else, so a test server never reaches the web', async () => {
		expect(await linkPreview(env.DB, 'https://www.youtube.com/watch?v=abc', onlyFrom('http://localhost:5192'), 1000)).toEqual({kind: 'none'});
	});
});

describe('Asking for a link\'s preview', () => {
	it('is refused for an address that is not on the web', async () => {
		const user1 = as('user-1@juggle.test');
		expect((await user1(`/api/previews?url=${encodeURIComponent('file:///etc/passwd')}`)).status).toBe(400);
		expect((await user1('/api/previews')).status).toBe(400);
	});

	it('needs signing in', async () => {
		expect((await exports.default.fetch(`http://juggle.test/api/previews?url=${encodeURIComponent('https://example.org')}`)).status).toBe(401);
	});
});

describe('Removing a Message\'s preview', () => {
	it('by its author removes it for everyone', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, 'Read https://example.org');
		expect(sent.preview).toEqual({kind: 'shown'});
		expect((await removePreview(user1, thread, sent.id)).status).toBe(200);
		expect((await messages(user2, thread))[0].preview).toEqual({kind: 'removed'});
	});

	it('is refused for anyone but its author', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, 'Read https://example.org');
		expect((await removePreview(user2, thread, sent.id)).status).toBe(403);
		expect((await messages(user1, thread))[0].preview).toEqual({kind: 'shown'});
	});

	it('is refused for a Message not in the Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const other = await startThread(user1);
		const sent = await send(user1, thread, 'Read https://example.org');
		expect((await removePreview(user1, other, sent.id)).status).toBe(404);
	});
});
