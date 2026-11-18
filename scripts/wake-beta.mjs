// Wakes the beta Worker deployed a moment ago before its browser tests run.
// A fresh Worker, its database and its Durable Objects can be slow to answer
// their first request, which would fail the first test for a reason that has
// nothing to do with the change. One read of the Threads and one live
// connection, each awaited once, start all three. Any failure stops the
// deploy, since a beta that cannot answer these would fail every test anyway.
import {readFileSync} from 'node:fs';

const beta = JSON.parse(readFileSync('beta-tokens.json', 'utf8'));
const [, token] = Object.entries(beta.people)[0];
const headers = {'CF-Access-Client-Id': token.clientId, 'CF-Access-Client-Secret': token.clientSecret};

const threads = await fetch(`${beta.url}/api/threads`, {headers, redirect: 'manual'});
if (!threads.ok) throw new Error(`Beta answered ${threads.status} when asked for its Threads`);

await new Promise((resolve, reject) => {
	const live = new WebSocket(`${beta.url.replace(/^http/, 'ws')}/api/live`, {headers});
	live.addEventListener('open', () => {
		live.close();
		resolve();
	});
	live.addEventListener('error', () => reject(new Error('Beta refused a live connection')));
});
console.log('Beta is awake');
