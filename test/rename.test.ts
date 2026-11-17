import {env} from 'cloudflare:test';
import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Thread} from '../src/shared/api';

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
const rename = (ask: Ask, id: string, title: unknown) => ask(`/api/threads/${id}/title`, {method: 'PUT', body: JSON.stringify({title})});
const titleOf = async (ask: Ask, id: string) => ((await (await ask('/api/threads')).json()) as Thread[]).find((t) => t.id === id)?.title;

describe('Renaming a Thread', () => {
	it('by anyone in it changes its title for everyone, without spaces around it', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		await user2('/api/me');
		const id = await startThread(user1);
		expect((await rename(user2, id, '  Is will free? ')).status).toBe(200);
		expect(await titleOf(user1, id)).toBe('Is will free?');
	});

	it('is refused for a blank title', async () => {
		const user1 = as('user-1@juggle.test');
		const id = await startThread(user1);
		expect((await rename(user1, id, '  ')).status).toBe(400);
		expect(await titleOf(user1, id)).toBe('Free will');
	});

	it('is refused for a Thread that does not exist', async () => {
		expect((await rename(as('user-1@juggle.test'), crypto.randomUUID(), 'New')).status).toBe(404);
	});

	it('is refused for a Person who is not in the Thread', async () => {
		const user1 = as('user-1@juggle.test');
		const user2 = as('user-2@juggle.test');
		const {id: user2Id} = (await (await user2('/api/me')).json()) as {id: string};
		const id = await startThread(user1);
		// Everyone is in every Thread for now, so the test takes user-2 out itself.
		await env.DB.prepare('DELETE FROM thread_people WHERE thread_id = ? AND person_id = ?').bind(id, user2Id).run();
		expect((await rename(user2, id, 'Taken over')).status).toBe(404);
		expect(await titleOf(user1, id)).toBe('Free will');
	});
});
