import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Thread} from '../src/shared/api';

// The tests run with SIGN_IN "local", so a cookie says who is asking.
function as(email: string) {
	return (path: string, init: RequestInit = {}) =>
		exports.default.fetch(`http://juggle.test${path}`, {...init, headers: {...init.headers, Cookie: `juggle_local_email=${email}`}});
}

const start = (ask: ReturnType<typeof as>, title: string, id: string = crypto.randomUUID()) =>
	ask('/api/threads', {method: 'POST', body: JSON.stringify({id, title})});

describe('Threads', () => {
	it('are refused to someone who is not signed in', async () => {
		const response = await exports.default.fetch('http://juggle.test/api/threads');
		expect(response.status).toBe(401);
	});

	it('started by one Person are seen by another, newest first', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/threads');
		await start(user1, 'Free will');
		await start(user1, 'What is a number');
		const threads = (await (await user2('/api/threads')).json()) as Thread[];
		expect(threads.map((t) => t.title)).toEqual(['What is a number', 'Free will']);
	});

	it('started before someone joined are seen by them', async () => {
		await start(as('user-1@juggle.test'), 'Free will');
		const threads = (await (await as('user-3@juggle.test')('/api/threads')).json()) as Thread[];
		expect(threads.map((t) => t.title)).toEqual(['Free will']);
	});

	it('started again with the same id are kept once', async () => {
		const user1 = as('user-1@juggle.test');
		const id = crypto.randomUUID();
		await start(user1, 'Free will', id);
		expect((await start(user1, 'Free will', id)).status).toBe(200);
		expect(((await (await user1('/api/threads')).json()) as Thread[]).length).toBe(1);
	});

	it('cannot take an id another Person already used', async () => {
		const id = crypto.randomUUID();
		await start(as('user-1@juggle.test'), 'Free will', id);
		expect((await start(as('user-2@juggle.test'), 'Something else', id)).status).toBe(409);
	});

	it('cannot be started without a title', async () => {
		expect((await start(as('user-1@juggle.test'), '  ')).status).toBe(400);
	});
});
