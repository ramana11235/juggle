import {applyD1Migrations, type D1Migration} from 'cloudflare:test';
import {env} from 'cloudflare:workers';
import {beforeEach} from 'vitest';

await applyD1Migrations(env.DB, (env as unknown as {TEST_MIGRATIONS: D1Migration[]}).TEST_MIGRATIONS);

// Storage is kept apart only per test file, so every test also starts by
// emptying every table, leaving each with a database of its own.
beforeEach(async () => {
	const {results} = await env.DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'",
	).all<{name: string}>();
	await env.DB.batch([env.DB.prepare('PRAGMA defer_foreign_keys = ON'), ...results.map(({name}) => env.DB.prepare(`DELETE FROM "${name}"`))]);
});
