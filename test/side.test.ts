import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Message, Place, Thread} from '../src/shared/api';

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
const post = (ask: Ask, threadId: string, body: string, place?: Place) =>
	ask(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify({id: crypto.randomUUID(), parts: [{kind: 'text', text: body}], ...(place && {place})})});
const send = async (ask: Ask, threadId: string, body: string, place?: Place) => (await (await post(ask, threadId, body, place)).json()) as Message;
const side = (messageId: string): Place => ({kind: 'side', messageId});
const see = (ask: Ask, threadId: string, messageId: string) => ask(`/api/threads/${threadId}/seen`, {method: 'POST', body: JSON.stringify({messageId})});
const thread = async (ask: Ask, id: string) => ((await (await ask('/api/threads')).json()) as Thread[]).find((t) => t.id === id)!;
const messages = async (ask: Ask, threadId: string) => (await (await ask(`/api/threads/${threadId}/messages`)).json()) as Message[];

describe('Side discussions', () => {
	it('hold Messages under a Message in the main conversation', async () => {
		const user1 = as('user-1@juggle.test');
		const id = await startThread(user1);
		const parent = await send(user1, id, 'Free means uncaused.');
		const aside = await send(user1, id, 'What about chance?', side(parent.id));
		expect(parent.place).toEqual({kind: 'main'});
		expect(aside.place).toEqual(side(parent.id));
		expect((await messages(user1, id)).map((m) => m.place)).toEqual([{kind: 'main'}, side(parent.id)]);
	});

	it('cannot be started under a Message inside a side discussion', async () => {
		const user1 = as('user-1@juggle.test');
		const id = await startThread(user1);
		const parent = await send(user1, id, 'Free means uncaused.');
		const aside = await send(user1, id, 'What about chance?', side(parent.id));
		expect((await post(user1, id, 'Deeper', side(aside.id))).status).toBe(400);
	});

	it('cannot be started under a Message in another Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const elsewhere = await send(user1, await startThread(user1), 'Elsewhere');
		expect((await post(user1, await startThread(user1), 'Here', side(elsewhere.id))).status).toBe(400);
	});

	it('count their new Messages as unseen in the Thread until seen there', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const id = await startThread(user1);
		const parent = await send(user1, id, 'Free means uncaused.');
		await see(user2, id, parent.id);
		const aside = await send(user1, id, 'What about chance?', side(parent.id));
		await send(user1, id, 'And luck?', side(parent.id));
		expect((await thread(user2, id)).unseen).toBe(2);
		await see(user2, id, aside.id);
		expect((await thread(user2, id)).unseen).toBe(1);
	});

	it('have a seen point of their own, apart from the main conversation', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		const two = await (await user2('/api/me')).json<{id: string}>();
		const id = await startThread(user1);
		const parent = await send(user1, id, 'Free means uncaused.');
		const aside = await send(user1, id, 'What about chance?', side(parent.id));
		await send(user1, id, 'Back to the main point');
		await see(user2, id, aside.id);
		const read = await thread(user2, id);
		expect(read.unseen).toBe(2);
		expect(read.seen.find((p) => p.personId === two.id)!.upTo).toEqual({kind: 'nothing'});
		expect(read.sides).toEqual([{messageId: parent.id, seen: expect.arrayContaining([{personId: two.id, upTo: {kind: 'message', sentAt: aside.sentAt}}])}]);
	});
});
