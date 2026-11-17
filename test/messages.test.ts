import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Message, Thread} from '../src/shared/api';

// The tests run with SIGN_IN "local", so a cookie says who is asking.
function as(email: string) {
	return (path: string, init: RequestInit = {}) =>
		exports.default.fetch(`http://juggle.test${path}`, {...init, headers: {...init.headers, Cookie: `juggle_local_email=${email}`}});
}
type Ask = ReturnType<typeof as>;

async function startThread(ask: Ask, title = 'Free will'): Promise<string> {
	const id = crypto.randomUUID();
	await ask('/api/threads', {method: 'POST', body: JSON.stringify({id, title})});
	return id;
}
const send = (ask: Ask, threadId: string, body: string, id: string = crypto.randomUUID()) =>
	ask(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify({id, body})});
const messages = async (ask: Ask, threadId: string) => (await (await ask(`/api/threads/${threadId}/messages`)).json()) as Message[];

describe('Messages', () => {
	it('sent by one Person are read by another, oldest first', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		await send(user1, thread, 'What do we mean by free?');
		await send(user2, thread, 'Uncaused, I think.');
		expect((await messages(user2, thread)).map((m) => m.body)).toEqual(['What do we mean by free?', 'Uncaused, I think.']);
	});

	it('sent again with the same id are saved once', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const id = crypto.randomUUID();
		await send(user1, thread, 'Once', id);
		expect((await send(user1, thread, 'Once', id)).status).toBe(200);
		expect((await messages(user1, thread)).length).toBe(1);
	});

	it('cannot take an id another Person already used', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const id = crypto.randomUUID();
		await send(user1, thread, 'Mine', id);
		expect((await send(as('user-2@juggle.test'), thread, 'Theirs', id)).status).toBe(409);
	});

	it('cannot be sent to a Thread that does not exist', async () => {
		expect((await send(as('user-1@juggle.test'), crypto.randomUUID(), 'Hello')).status).toBe(404);
	});

	it('cannot be empty', async () => {
		const user1 = as('user-1@juggle.test');
		expect((await send(user1, await startThread(user1), '   ')).status).toBe(400);
	});

	it('put their Thread first in the list, with the newest Message shown', async () => {
		const user1 = as('user-1@juggle.test');
		const older = await startThread(user1, 'Older');
		await startThread(user1, 'Newer');
		await send(user1, older, 'Back to this one');
		const threads = (await (await user1('/api/threads')).json()) as Thread[];
		expect(threads.map((t) => t.title)).toEqual(['Older', 'Newer']);
		expect(threads[0].last).toMatchObject({kind: 'message', body: 'Back to this one'});
		expect(threads[1].last).toEqual({kind: 'none'});
	});
});
