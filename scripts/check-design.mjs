// Fails when a screen's code goes around Juggle's design rules, listing
// every place it does. Run by `npm test` and by CI's checks.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {designProblems} from './design-rules.mjs';

const files = (dir) =>
	readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? files(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
	});

const found = files('src/app').flatMap((file) => designProblems(readFileSync(file, 'utf8')).map((p) => `${file}:${p.line} has ${p.what}`));
if (found.length > 0) {
	console.error(`Juggle's design rules (docs/design.md) are not followed:\n${found.join('\n')}`);
	process.exit(1);
}
