#!/usr/bin/env bash
# Deploys Juggle from this laptop in an order that never skips a step. The
# beta copy is deployed and tested end to end through real Access first, and
# only if that passes is the real Juggle touched: a copy of its database is
# kept, migrations are applied, and it is deployed. It stops at the first
# step that fails.
set -euo pipefail
cd "$(dirname "$0")/.."

for file in wrangler.jsonc wrangler.beta.jsonc beta-tokens.json; do
	[ -f "$file" ] || { echo "$file is missing: it holds hosting config that git does not keep." >&2; exit 1; }
done

npm run typecheck
npm test

npx wrangler d1 migrations apply DB --remote -c wrangler.beta.jsonc
WRANGLER_CONFIG=wrangler.beta.jsonc npx vite build
npx wrangler deploy
JUGGLE_TARGET=beta npx playwright test

mkdir -p backups
npx wrangler d1 export DB --remote -c wrangler.jsonc --output "backups/juggle-$(date -u +%Y-%m-%dT%H-%M-%SZ).sql"
npx wrangler d1 migrations apply DB --remote -c wrangler.jsonc
WRANGLER_CONFIG=wrangler.jsonc npx vite build
npx wrangler deploy
