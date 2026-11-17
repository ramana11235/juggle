import {describe, expect, it} from 'vitest';
import {personForServiceToken} from '../src/worker/who';

describe('a service token', () => {
	it('signs in as the test Person its client id is named for', () => {
		expect(personForServiceToken('{"abc.access": "User-1@juggle.test"}', 'abc.access')).toEqual({kind: 'email', email: 'user-1@juggle.test'});
	});
	it('signs in as nobody when its client id is not named', () => {
		expect(personForServiceToken('{"abc.access": "user-1@juggle.test"}', 'other.access')).toEqual({kind: 'nobody'});
	});
	it('signs in as nobody where no tokens are named, as on the real Juggle', () => {
		expect(personForServiceToken('{}', 'abc.access')).toEqual({kind: 'nobody'});
	});
});
