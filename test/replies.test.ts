import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Message, Part} from '../src/shared/api';

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
async function send(ask: Ask, threadId: string, message: {body: string} | {parts: Part[]}): Promise<Response> {
	return ask(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify({id: crypto.randomUUID(), ...message})});
}
const messages = async (ask: Ask, threadId: string) => (await (await ask(`/api/threads/${threadId}/messages`)).json()) as Message[];

describe('Replies', () => {
	it('keep their quotes and words in order, for everyone in the Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const original = (await (await send(user1, thread, {body: 'Free means uncaused. Then nothing is free.'})).json()) as Message;
		const parts: Part[] = [
			{kind: 'passage', messageId: original.id, text: 'Free means uncaused.'},
			{kind: 'text', text: 'I disagree.'},
			{kind: 'passage', messageId: original.id, text: 'Then nothing is free.'},
			{kind: 'text', text: 'That follows.'},
		];
		expect((await send(user2, thread, {parts})).status).toBe(200);
		const reply = (await messages(user1, thread))[1];
		expect(reply.parts).toEqual(parts);
		expect(reply.body).toBe('I disagree.\n\nThat follows.');
	});

	it('can answer a whole Message', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const original = (await (await send(user1, thread, {body: 'Free means uncaused.'})).json()) as Message;
		const parts: Part[] = [{kind: 'whole', messageId: original.id, text: 'Free means uncaused.'}, {kind: 'text', text: 'Yes.'}];
		await send(user1, thread, {parts});
		expect((await messages(user1, thread))[1].parts).toEqual(parts);
	});

	it('are refused when they quote a Message from another Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const elsewhere = await startThread(user1);
		const thread = await startThread(user1);
		const other = (await (await send(user1, elsewhere, {body: 'Somewhere else'})).json()) as Message;
		const reply = await send(user1, thread, {parts: [{kind: 'passage', messageId: other.id, text: 'Somewhere'}, {kind: 'text', text: 'Hm.'}]});
		expect(reply.status).toBe(400);
		expect(await messages(user1, thread)).toEqual([]);
	});
});

describe('Messages sent as a body alone', () => {
	it('come back as one part of text', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		await send(user1, thread, {body: 'Plain words'});
		expect((await messages(user1, thread))[0].parts).toEqual([{kind: 'text', text: 'Plain words'}]);
	});
});
