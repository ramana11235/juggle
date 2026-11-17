import {exports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

describe('the Worker', () => {
	it('answers that it is running', async () => {
		const response = await exports.default.fetch('http://juggle.test/api/health');
		expect(await response.json()).toEqual({ok: true});
	});
});
