import {cloudflareTest, readD1Migrations} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

// Tests run inside workerd, each test file with storage of its own, and
// test/apply-migrations.ts gives each a database with every migration applied.
export default defineConfig(async () => ({
	plugins: [
		cloudflareTest({
			wrangler: {configPath: './wrangler.example.jsonc'},
			miniflare: {bindings: {TEST_MIGRATIONS: await readD1Migrations('migrations')}},
		}),
	],
	test: {include: ['test/**/*.test.ts'], setupFiles: ['test/apply-migrations.ts']},
}));
