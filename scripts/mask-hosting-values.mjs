// Prints a GitHub Actions mask for every hosting value in the git-ignored
// config, so a public CI log shows *** where one would appear. A hosting
// value is any value in wrangler.jsonc or wrangler.beta.jsonc that differs
// from the placeholder at the same place in wrangler.example.jsonc, and every
// value in beta-tokens.json.
import {readFileSync} from 'node:fs';

const read = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, ''));

function values(value, example, found) {
	if (typeof value === 'string') {
		if (value !== example) found.add(value);
	} else if (value && typeof value === 'object') {
		for (const [key, inner] of Object.entries(value)) values(inner, example?.[key], found);
	}
	return found;
}

const example = read('wrangler.example.jsonc');
const found = new Set();
values(read('wrangler.jsonc'), example, found);
values(read('wrangler.beta.jsonc'), example, found);
values(read('beta-tokens.json'), undefined, found);
// Each value is also masked in pieces, such as a host on its own, leaving out
// pieces any log is full of, such as https.
const common = new Set(['https', 'http', 'access']);
for (const value of found) {
	for (const part of new Set([value, ...value.split(/[\s,;:{}"[\]/]+/)])) {
		if (part.length > 3 && !common.has(part) && !part.endsWith('@juggle.test')) console.log(`::add-mask::${part}`);
	}
}
