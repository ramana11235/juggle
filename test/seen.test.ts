import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Message, Person, Thread} from '../src/shared/api';

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
const see = (ask: Ask, threadId: string, messageId: string) => ask(`/api/threads/${threadId}/seen`, {method: 'POST', body: JSON.stringify({messageId})});
const thread = async (ask: Ask, id: string) => ((await (await ask('/api/threads')).json()) as Thread[]).find((t) => t.id === id)!;
const me = async (ask: Ask) => (await (await ask('/api/me')).json()) as Person;

describe('Seen points', () => {
	it('count as unseen only the Messages others sent after a Person\'s point', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await me(user2);
		const id = await startThread(user1);
		const first = await send(user1, id, 'one');
		await send(user1, id, 'two');
		await send(user2, id, 'mine');
		expect((await thread(user2, id)).unseen).toBe(2);
		await see(user2, id, first.id);
		expect((await thread(user2, id)).unseen).toBe(1);
		expect((await thread(user1, id)).unseen).toBe(1);
	});

	it('only move forward', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await me(user2);
		const id = await startThread(user1);
		const first = await send(user1, id, 'one');
		const second = await send(user1, id, 'two');
		await see(user2, id, second.id);
		expect((await see(user2, id, first.id)).status).toBe(204);
		expect((await thread(user2, id)).unseen).toBe(0);
	});

	it('of everyone in a Thread are in the Thread, at nothing seen until they see something', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		const [one, two] = [await me(user1), await me(user2)];
		const id = await startThread(user1);
		const message = await send(user1, id, 'one');
		await see(user2, id, message.id);
		expect((await thread(user1, id)).seen).toEqual(
			[{personId: one.id, upTo: {kind: 'nothing'}}, {personId: two.id, upTo: {kind: 'message', sentAt: message.sentAt}}].sort((a, b) => a.personId.localeCompare(b.personId)),
		);
	});

	it('are refused for a Message that is not in the Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const id = await startThread(user1);
		const other = await startThread(user1);
		const message = await send(user1, other, 'elsewhere');
		expect((await see(user1, id, message.id)).status).toBe(404);
		expect((await see(user1, id, 'not-an-id')).status).toBe(400);
	});
});
