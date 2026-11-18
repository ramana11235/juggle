## Agent skills

### Issue tracker

Issues are GitHub Issues on this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels are used as they are: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

One context: a single `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`. Every product and technical decision made before building started, with its reasons, is in `docs/grill.md`.

## Principles

These are Juggle's own, about what it does for the People using it.

- Build each feature once its shape becomes clear from using the app. Do not build features from guesses about what will help.
- Talking in Juggle feels like WhatsApp, Slack or Discord. When a question is about how chatting should behave, start from what those apps do.
- Say nothing that the screen already makes obvious. Text boxes have no hint text.
- Show status with icons and marks, not words. The words on screen should be the ones People wrote, so read status is ticks and unseen Messages are a count in a filled circle.
- Juggle is for any number of People, though it starts with two. Nothing is built around there being exactly two.

How software is built here follows the global engineering rules, such as test pyramids, deterministic tests and expand and contract, unless this file sets an exception.

## Workflow

Every piece of work on Juggle is an issue first, and the issues are its backlog and its permanent record. The queue of what comes next is the repo's GitHub Projects board (see `docs/agents/issue-tracker.md`). The manager Session builds each ready issue itself on main, with no subagents.

### Working in this repo

- `npm run dev` serves the app and runs the Worker in workerd beside it, as Cloudflare would, on port 5192 and on the Wi-Fi to try on a phone. Access is not in front of it, so choose who you are by opening `/api/local/sign-in?as=<any email>`; two browsers signed in as different emails are two People.
- `npm test` runs the Worker tests in workerd and then the browser tests on a laptop-sized Chromium and on WebKit as an iPhone.
- `JUGGLE_TARGET=beta npx playwright test` runs only the browser tests tagged `@beta` against the beta copy on Cloudflare through real Access. Beta is for what only real Cloudflare can show, so a test is tagged `@beta` only when its path depends on Access, the Durable Objects or the real D1, and every other test runs only against a local Juggle. The tests sign in as test People with the service tokens in the git-ignored `beta-tokens.json`. Beta's database holds only test data and is emptied before and after each test.
- Test People are named for the role they play, such as `user-1@juggle.test`, never with made-up names.
- After changing `wrangler.example.jsonc`, run `npm run types` to update `worker-configuration.d.ts`.
- Keep throwaway UI versions in `.scratch/juggle/prototypes/`, which is not part of the repo. A prototype whose answer is agreed is committed to a throwaway branch out of main, as the record of what was agreed.
- The repo is public, so nothing personal is ever committed: no emails, no names of the People using Juggle, no hosting values. Those live in the git-ignored `wrangler.jsonc`, `wrangler.beta.jsonc` and `beta-tokens.json`.

### UI changes

For anything about how Juggle looks or feels, build a quick throwaway version with made-up data that I can run and try on my laptop and phone, and get my feedback on that before changing the real thing. Show each option in the prototype itself, and remove the options a decision replaces.

### From an issue to the running Juggle

1. **Start from an issue.** Every change has an issue before the code changes, even a typo. An issue an agent writes starts as `needs-triage`, and only I say an issue is ready.
2. **Build it test first.** Follow the tdd skill: write one failing test for one behaviour, make it pass with the least code, then refactor, and repeat. While doing so, run only the test being worked on, such as `npx vitest run test/<file>.test.ts` or `npx playwright test test/browser/<file>.spec.ts --project=laptop`. Build and try the change with `npm run dev`, never against the hosted Juggle.
3. **Prove it.** A change comes with tests: rules as plain functions in vitest, and for a change people can see, a browser test in `test/browser/` named with one plain sentence for the behaviour, which waits only on settled values on the page, never on time. Before each commit, run `npm run typecheck`, all the Worker tests with `npx vitest run`, and the feature's browser specs on both screens. Before saying a change is ready to push, run the whole `npm test` once. Only CI runs the tests against beta.
4. **Review it.** After each feature, review everything changed for it with `/ponytail-review`, following `docs/agents/review.md`. Each finding becomes an issue. Must-fix and should-fix findings are queued on the board straight after the feature and built before the next feature; the rest go to triage for me.
5. **Record it.** Update `CONTEXT.md`, the ADRs and the issue with anything that changed while building it.
6. **Commit it**, following `docs/agents/commits.md`. Never push: code is pushed only when I say so.
7. **Deploy it** by pushing to main, once I say to push. CI runs the checks, the Worker tests and every browser test against a local Juggle, split across several machines, and once they all pass runs `npm run deploy`, which deploys the beta copy, runs the `@beta` tests against it through real Access, and only then prints the point the real database can be restored to, applies migrations and deploys the real Juggle, stopping at the first failure. A pull request runs only the checks and tests. Never deploy from the laptop.
8. **Hand it over proven.** Every check that can be automated is a test that the deploy runs, so a finished feature is handed over as ready to use, never with a request to try it. Only what needs a real device or my judgement of how it looks and feels is left to me. Tick each acceptance criterion, bring the record of where the work stands up to date and stop for my feedback.

### Close the feedback loop

Whenever you see a bug, hear me ask for a feature, or notice a chance to improve something, write it as an issue straight away, even in the middle of other work, then carry on. Nothing noticed is left only in a conversation.

### Changing the API and the schema

A screen left open runs old code until it is reloaded, and `wrangler rollback` restores the Worker but not the database, so both change by expand and contract. Add the new thing alongside the old one, and remove the old thing in a later change once nothing uses it, keeping that removal as an issue until it is done. A migration only adds what the running Worker ignores, such as a new table or a column with a default.
