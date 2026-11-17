import {env} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import {joinPerson, messagesIn, peopleIn, sendMessage, startThread, threadsOf} from '../src/worker/store';

describe('the order things are saved in', () => {
	it('keeps Messages saved in the same millisecond in the order they were sent', async () => {
		const now = 1_800_000_000_000;
		const user1 = await joinPerson(env.DB, 'user-1@juggle.test', now);
		const thread = crypto.randomUUID();
		await startThread(env.DB, user1, {id: thread, title: 'Free will'}, now);
		for (const body of ['first', 'second', 'third']) await sendMessage(env.DB, user1, thread, {id: crypto.randomUUID(), parts: [{kind: 'text', text: body}], place: {kind: 'main'}}, now);
		const read = await messagesIn(env.DB, user1, thread);
		expect(read.kind === 'messages' && read.messages.map((m) => m.body)).toEqual(['first', 'second', 'third']);
	});

	it('keeps Threads started in the same millisecond newest first', async () => {
		const now = 1_800_000_000_000;
		const user1 = await joinPerson(env.DB, 'user-1@juggle.test', now);
		for (const title of ['first', 'second', 'third']) await startThread(env.DB, user1, {id: crypto.randomUUID(), title}, now);
		expect((await threadsOf(env.DB, user1)).map((t) => t.title)).toEqual(['third', 'second', 'first']);
	});
});

describe('who is told of a change', () => {
	it('is everyone in the Thread, including someone who joined after it started', async () => {
		const user1 = await joinPerson(env.DB, 'user-1@juggle.test', 1);
		const thread = crypto.randomUUID();
		await startThread(env.DB, user1, {id: thread, title: 'Free will'}, 2);
		const user2 = await joinPerson(env.DB, 'user-2@juggle.test', 3);
		expect(await peopleIn(env.DB, thread)).toEqual([user1.id, user2.id].sort());
	});
});
