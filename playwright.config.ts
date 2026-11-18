import {defineConfig, devices} from '@playwright/test';
import {target} from './test/browser/juggle';

// Every browser test runs on a laptop-sized Chromium and on WebKit as an
// iPhone with touch, against the Juggle that test/browser/juggle.ts names, so
// no server is started here. Locally each test has a Juggle of its own and
// they run side by side; on beta they share one, so they run one at a time. A failed test is never run again, because a
// test that passes on a second try says nothing.
export default defineConfig({
	testDir: 'test/browser',
	globalTeardown: './test/browser/leftovers.ts',
	retries: 0,
	// Beta is for what only real Cloudflare can show, such as Access, so only
	// the tests tagged @beta run there. Every test runs against a local Juggle.
	grep: target === 'beta' ? /@beta/ : undefined,
	fullyParallel: target === 'local',
	workers: target === 'local' ? undefined : 1,
	reporter: process.env.CI ? 'github' : 'list',
	// A trace of each failed test shows what the page was still waiting on.
	use: {contextOptions: {reducedMotion: 'reduce'}, trace: 'retain-on-failure'},
	projects: [
		{name: 'laptop', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}}},
		{name: 'phone', use: {...devices['iPhone 15']}},
	],
});
