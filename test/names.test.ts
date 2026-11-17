import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import type {Person} from '../src/shared/api';

function as(email: string) {
	return (path: string, init: RequestInit = {}) =>
		exports.default.fetch(`http://juggle.test${path}`, {...init, headers: {...init.headers, Cookie: `juggle_local_email=${email}`}});
}
const name = (ask: ReturnType<typeof as>, text: unknown) => ask('/api/me/name', {method: 'PUT', body: JSON.stringify({name: text})});
const me = async (ask: ReturnType<typeof as>) => (await (await ask('/api/me')).json()) as Person;

describe('Names', () => {
	it('a Person who has just joined has no name yet', async () => {
		expect((await me(as('user-1@juggle.test'))).name).toEqual({kind: 'none'});
	});

	it('a name a Person gives is what other People see, without spaces around it', async () => {
		const user1 = as('user-1@juggle.test');
		expect((await name(user1, '  Sam ')).status).toBe(200);
		const people = (await (await as('user-2@juggle.test')('/api/people')).json()) as Person[];
		expect(people.find((p) => p.email === 'user-1@juggle.test')!.name).toEqual({kind: 'given', text: 'Sam'});
	});
});
