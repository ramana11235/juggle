import {readFileSync} from 'node:fs';
import {expect, target, test} from './juggle';

// These check the beta copy's sign-in itself, so they run only against beta.
test.skip(target !== 'beta', 'Only the beta copy has Access in front of it');

const beta = () => JSON.parse(readFileSync('beta-tokens.json', 'utf8')) as {url: string; unauthorized: {clientId: string; clientSecret: string}};

test('beta asks for sign-in when no service token is sent', async ({request}) => {
	const response = await request.get(`${beta().url}/api/threads`, {maxRedirects: 0});
	expect(response.status()).toBe(302);
	expect(response.headers().location).toContain('cloudflareaccess.com');
});

test('beta refuses a service token its config does not name as a Person', async ({request}) => {
	const {url, unauthorized} = beta();
	const response = await request.get(`${url}/api/threads`, {headers: {'CF-Access-Client-Id': unauthorized.clientId, 'CF-Access-Client-Secret': unauthorized.clientSecret}});
	expect(response.status()).toBe(401);
});
