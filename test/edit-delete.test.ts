import {env, exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Message, Part, Thread} from '../src/shared/api';

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
const send = async (ask: Ask, threadId: string, message: {body: string} | {parts: Part[]}) =>
	(await (await ask(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify({id: crypto.randomUUID(), ...message})})).json()) as Message;
const edit = (ask: Ask, threadId: string, id: string, parts: Part[]) => ask(`/api/threads/${threadId}/messages/${id}`, {method: 'PUT', body: JSON.stringify({parts})});
const remove = (ask: Ask, threadId: string, id: string) => ask(`/api/threads/${threadId}/messages/${id}`, {method: 'DELETE'});
const messages = async (ask: Ask, threadId: string) => (await (await ask(`/api/threads/${threadId}/messages`)).json()) as Message[];
const text = (text: string): Part => ({kind: 'text', text});

describe('Editing a Message', () => {
	it('by its author changes its words for everyone and says when it was edited', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, {body: 'Free means uncaused.'});
		expect(sent.edited).toEqual({kind: 'never'});
		expect((await edit(user1, thread, sent.id, [text('Free means unforced.')])).status).toBe(200);
		const [read] = await messages(user2, thread);
		expect([read.body, read.parts, read.edited.kind]).toEqual(['Free means unforced.', [text('Free means unforced.')], 'at']);
	});

	it('leaves a Reply quoting it with the words as they were answered', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const original = await send(user1, thread, {body: 'Free means uncaused.'});
		await send(user1, thread, {parts: [{kind: 'passage', messageId: original.id, text: 'uncaused'}, text('Why?')]});
		await edit(user1, thread, original.id, [text('Free means unforced.')]);
		expect((await messages(user1, thread))[1].parts[0]).toEqual({kind: 'passage', messageId: original.id, text: 'uncaused'});
	});

	it('is refused for anyone but its author', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, {body: 'Free means uncaused.'});
		expect((await edit(user2, thread, sent.id, [text('Taken over')])).status).toBe(403);
		expect((await messages(user1, thread))[0].body).toBe('Free means uncaused.');
	});

	it('is refused for a Message that was deleted', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, {body: 'Free means uncaused.'});
		await remove(user1, thread, sent.id);
		expect((await edit(user1, thread, sent.id, [text('Back again')])).status).toBe(409);
	});
});

describe('Deleting a Message', () => {
	it('by its author removes its words and every quote of them', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const original = await send(user1, thread, {body: 'Free means uncaused.'});
		await send(user2, thread, {parts: [{kind: 'passage', messageId: original.id, text: 'uncaused'}, text('Why?')]});
		expect((await remove(user1, thread, original.id)).status).toBe(200);
		const [deleted, reply] = await messages(user2, thread);
		expect([deleted.deleted, deleted.body, deleted.parts]).toEqual([true, '', []]);
		expect(reply.parts).toEqual([{kind: 'deleted', messageId: original.id}, text('Why?')]);
		const list = (await (await user2('/api/threads')).json()) as Thread[];
		expect(JSON.stringify(list)).not.toContain('uncaused');
		const kept = await env.DB.prepare('SELECT text FROM message_parts WHERE quoted_id = ?').bind(original.id).all<{text: string}>();
		expect(kept.results).toEqual([{text: ''}]);
	});

	it('is refused for anyone but its author', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const thread = await startThread(user1);
		const sent = await send(user1, thread, {body: 'Free means uncaused.'});
		expect((await remove(user2, thread, sent.id)).status).toBe(403);
		expect((await messages(user1, thread))[0].deleted).toBe(false);
	});

	it('is refused for a Message not in the Thread named', async () => {
		const user1 = as('user-1@juggle.test');
		const thread = await startThread(user1);
		expect((await remove(user1, thread, crypto.randomUUID())).status).toBe(404);
	});
});
