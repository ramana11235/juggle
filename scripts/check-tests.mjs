// Fails when test code waits on time or tries again, because such a test
// passes or fails by chance. A test waits only on a settled value, such as
// the page's settled mark. Run first by `npm test`.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const forbidden = [
	[/\bsetTimeout\s*\(|\bsetInterval\s*\(/, 'a timer'],
	[/\bsleep\s*\(/, 'a sleep'],
	[/\bwaitForTimeout\s*\(/, 'a fixed wait'],
	[/\bexpect\.poll\s*\(|\.toPass\s*\(/, 'polling'],
	[/\bretries\s*:\s*[1-9]|\.retry\s*\(/, 'retries'],
];

function files(dir) {
	return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? files(path) : /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [path] : [];
	});
}

const found = [];
for (const file of [...files('test'), 'playwright.config.ts', 'vitest.config.ts']) {
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, index) => {
			for (const [pattern, what] of forbidden) if (pattern.test(line)) found.push(`${file}:${index + 1} has ${what}: ${line.trim()}`);
		});
}
if (found.length > 0) {
	console.error(`Tests must wait only on settled values, never on time:\n${found.join('\n')}`);
	process.exit(1);
}
