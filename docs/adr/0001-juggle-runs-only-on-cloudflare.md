# Juggle runs only on Cloudflare

Juggle is a conversation between people on their own phones, so a copy running on one laptop could never be reached by the others and would be no use outside development. So Juggle has one server, a Cloudflare Worker with D1 and Durable Objects, and no version of its own for running on a laptop. Developing and testing happen on the laptop with Cloudflare's local tools: `wrangler dev` runs the same Worker, a local D1 and the Durable Objects, and the tests start a local D1 that lives in memory and is thrown away.

## Considered options

- Running entirely on a laptop as well, with a local server on a SQLite file. Rejected because nobody else could reach a laptop copy, and keeping two servers that behave the same is real work that brings Juggle nothing.

## Consequences

- Juggle cannot run without Cloudflare, so leaving Cloudflare later would mean rewriting the server's storage, live messages and deploys.
- Anything that only shows on the real Cloudflare, such as push notifications reaching a phone or the real sign-in, cannot be tried locally. Whether a separate staging copy is needed for those is decided on its own.
