import path from 'node:path';
import {cloudflare} from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// The Cloudflare plugin runs the Worker in workerd beside the app, so `vite`
// serves both as Cloudflare would. host: true serves it on the Wi-Fi to try on a phone.
// Development and the tests use the example config; a build for the hosted
// Juggle names the real one with WRANGLER_CONFIG=wrangler.jsonc. Each browser
// test gives its server a fresh folder for local data with JUGGLE_LOCAL_STATE.
export default defineConfig({
	plugins: [react(), tailwindcss(), cloudflare({
			configPath: process.env.WRANGLER_CONFIG ?? 'wrangler.example.jsonc',
			persistState: process.env.JUGGLE_LOCAL_STATE ? {path: process.env.JUGGLE_LOCAL_STATE} : true,
			// Test servers run side by side, so they do not all claim the debugger's port.
			inspectorPort: process.env.JUGGLE_LOCAL_STATE ? false : undefined,
			// Test servers fetch previews only from their own pages, so no test reaches the web.
			config: process.env.JUGGLE_LOCAL_STATE ? (worker) => ({vars: {...worker.vars, PREVIEWS_FROM: 'this_juggle'}}) : undefined,
		}),],
	resolve: {alias: {'@': path.resolve(import.meta.dirname, 'src/app')}},
	server: {host: true, port: 5192},
});
