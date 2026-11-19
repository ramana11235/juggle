# Grilling the idea for Juggle

This records the grilling of the idea, one question at a time, with each answer and the reasoning behind it. The idea comes first, then the design prototypes, then the tech stack and how Juggle is built and shipped.

## Principles

- Build each feature once its shape becomes clear from using the app. Do not build features from guesses about what will help.
- Say nothing that the screen already makes obvious. Text boxes have no hint text, because everyone knows what a text box is, and hints that change from place to place are inconsistent noise.
- Show status with icons and marks, not words. Juggle is a messaging app, so the words on screen should be the ones people wrote, and labels written beside them are jarring. Examples: read status is ticks, not "Read by" and a name; unseen Messages are a count in a filled circle, not "4 new".

## The idea, as first described (2026-11-16)

- A chat app, to be hosted on a subdomain of my own domain.
- The problem: I talk with someone every day about all sorts of things. Now and then we hit a topic we both care about and want to go deep on, such as philosophy. In WhatsApp that is hard to carry on. I may go away to research and reply days later, by which time the everyday chat has moved on, so coming back to the topic is awkward and means switching context. Bringing it up again breaks the flow of the conversation, and the other person may not be in the headspace for it then, so the topic gets forgotten.
- The idea: rooms or threads, each about one topic, like a conversation thread in Slack, that either of us comes back to whenever we are ready. The app should actively make that easy, not just allow it.
- I could use Discord or Slack, but I want to build it, and I think I can find features that really help with this problem.

## Decisions

### 1. Who Threads is for

Asked: is it for the two of us, for me and a few people I each talk with separately, or for anyone with this problem?

Decided: it is for the two of us. It is designed so that the number of people is not fixed at two, so that supporting more later does not need new concepts.

Why: the problem was described about one relationship, so the features are shaped by what two people need. A conversation whose people are a list, of which two is one case, costs nothing extra if it is designed that way from the start. What does need deciding later is the meaning of anything that depends on everyone, such as "when both of us are ready", which with more people could mean all of them or any of them. Each such feature is described per person, so that question only comes up once there are more people.

### 2. Whether the other person wants it

Asked: does the other person feel this problem too, and have they said they would use a separate app for deep topics?

Decided: yes to both. They feel the problem and have agreed to use it.

Why it was asked: an app for two people only works if both of them open it, and the other person's side of the problem may differ from mine, which would call for different features.

### 3. Whose side of the problem the design follows

Asked: what does the problem look like from the other person's side?

Decided: it does not need asking. The problem as I described it is general enough to build a first version around.

The parts of that problem, taken from my description, so the next decisions can say which parts the first version solves:
- A deep topic has no place of its own, so it gets lost in the everyday chat.
- Coming back to a topic days later is awkward and means switching context.
- Bringing a topic up again breaks the flow of the everyday chat.
- The other person may not be in the headspace for it at that moment.
- The topic gets forgotten.

### 4. What the first version is

Asked: is the first version threads alone, or threads plus something for one of the parts a thread does not solve (coming back is awkward, the other person may not be ready, the topic gets forgotten)?

Decided: threads alone are the minimum lovable product.

Why: a thread per topic solves two of the parts by itself, a place of its own and returning without breaking the flow. Which of the other three hurts most, and what a feature for it should look like, will show from using the app, following the principle above. The cost accepted is that the first version does no more than a Slack thread does, so what makes Threads better than Slack comes from what is built after it.

### 5. Where the everyday chat lives

Asked: does the everyday chat move into Threads, or stay in WhatsApp with Threads holding only the deep topics?

Decided: the everyday chat stays in WhatsApp. Threads holds only the deep topics. Inside Threads, talking should feel essentially the same as in WhatsApp, Slack or Discord.

Why: moving a whole daily conversation to a new app is a big ask, and the first version would have to match WhatsApp at everything to be usable. The cost accepted is that a topic usually comes up in WhatsApp, so one of us has to open Threads and start it there, and the moment it came up is not kept with it.

### 6. Which chat features the first version has

Asked: which chat features does the first version need to feel like WhatsApp or Slack?

Decided, in the first version:
- Messages appear the moment they are sent, without reloading.
- A notification arrives when the other person writes.
- Links in a message can be opened.
- A message can be a reply to a specific earlier message.
- I can edit or delete my own messages.
- I can see which of my messages the other person has seen.

Left until use shows they are needed: images, voice notes, reactions, typing indicators and search.

Why: without the first list a chat feels broken. The second list follows the principle of building a feature once use shows its shape. Images may well be the first wanted, such as a screenshot from research.

### 7. What one topic's conversation is, and its name

Asked: is a topic's conversation a thread hanging off a message, as in Slack, or a conversation of its own, as a WhatsApp group or Discord channel is? And what is it called?

Decided: a conversation of its own, with a title naming the topic, called a Thread. Recorded in CONTEXT.md.

Why: the everyday chat is not in the app, so there is nothing for a topic to hang off.

Also raised: an earlier name for the app was Juggle.

### 8. The name of the app

Decided: Juggle. Each topic's conversation is still called a Thread. The address becomes a juggle subdomain in place of a threads one.

Why: Juggle fits because two people keep several topics in the air at once, passing them back and forth and coming back to each, and the point is never to drop one. Threads only names where the topics are kept, and Meta has an app called Threads.

Other names put forward: Tangent, Simmer, Back burner, Mull, Rabbit hole, Salon, Loose ends, Pick up.

The words inside the app do not follow the name's metaphor, so a Thread is not a "ball". An app's name says what it is for, and the words inside it say plainly what each thing is, as Slack has channels and messages.

### 9. What Juggle opens on

Asked: when I open Juggle, what do I see first?

Decided: a list of every Thread, the one with the newest Message at the top, each showing its title and a mark when it has Messages I have not seen. The general feel is WhatsApp Desktop's, with Slack also liked, which I read as the list beside the open Thread on a wide screen. How it looks is worked out later with throwaway prototypes built with shadcn/ui.

Why: it is how WhatsApp and Slack open, so it fits talking feeling the same as there (decision 5), and it needs nothing beyond the first version's features. Ordering by who is ready, or bringing up Threads that have gone quiet, waits until use shows its shape.

### 10. Where Juggle is used

Asked: on phones, on laptops, or both?

Decided: both, equally, from the first version.

Why: research and long replies probably happen at a laptop, which suits the WhatsApp Desktop layout, while notifications arrive on the phone and topics come up there, where the WhatsApp chat happens. The cost accepted is that every screen has to work at both sizes.

### 11. How a Thread is started

Asked: how does a Thread get started?

Decided: either of us can start one. A Thread needs only a title naming the topic; its first Message is optional. The other person is notified that a new Thread exists, as for a new Message. Revised while planning push notifications (#13): a new Thread on its own notifies nobody; only Messages do, including those in side discussions. Either of us can change the title later.

Why: a Thread can then be made the moment a topic comes up in WhatsApp and written in later, after research. A topic often comes into focus only after talking about it, so the title can change.

### 12. Whether a Thread can end or be removed

Asked: can a Thread end, or be removed?

Decided: neither, in the first version. Deleting a Thread that has no Messages, offered for one started by mistake, is not included either.

Why: quiet Threads sink down the list by themselves, since it is ordered by newest Message. A deep topic rarely ends cleanly, and coming back to an old one months later is part of what the app is for. Marking a topic finished or hiding it waits until a long list gets in the way.

### 13. What a Message can contain

Asked: what can a Message contain beyond plain text?

Decided: essentially full Markdown, but without a toolbar or buttons for it. Whoever knows the syntax types it and it shows formatted, as WhatsApp does with its own formatting.

Why: deep topics mean long replies, written after research, with quotes and links, so they need laying out. Keeping the options out of sight keeps the screen as plain as a chat.

### 14. Replying to a long Message

Raised by me: when I send or get a wall of text, replying to it must be easy. At work in Slack the habit is to copy part of someone's message, quote it with ">" and write the response under it. Slack threads do this better. Quip lets people leave comments by highlighting a passage of a document. There may be something in between that makes this easier.

Decided (decision 14):
- A reply can answer a whole Message, as decision 6 already says.
- A reply can quote a passage selected from a Message, and one reply can quote several passages, each answered in turn, as an email reply answers inline. Each quote links to its place in the original, and the original marks the passage as answered.
- A Message can have a side discussion under it, as a Slack thread does, because I think it will be useful.
- Comments anchored to a highlighted passage, as in Quip, are kept for later.

### 15. Writing a Message as an article (kept for later)

Raised by me: a mode for writing something like an article or paper, because a philosophical discussion should first be stripped back to definitions, which ruins the flow of a chat. Sending each other articles makes it easier to discuss thoroughly. Not for now. Tracked in .scratch/article-mode/issues/01-write-an-article-mode.md, to move to the issue tracker once the repo exists.

### 16. What the Slack-style side discussion is called

Asked: Slack and Discord call it a thread, which clashes with Thread here. What is it called?

Decided: a side discussion, for now; the name may change. It is not called "replies", so that a Reply keeps one meaning: a Message in the main conversation answering an earlier one. Both recorded in CONTEXT.md.

### 17. Whether a side discussion counts as new in its Thread

Asked: does a Message in a side discussion move the Thread to the top of the list, show the unseen mark and send a notification?

Decided: yes, all three. Inside the Thread, the Message a side discussion hangs off shows how many Messages are under it, with the same unseen mark.

Why: it is still the other person talking about the topic, and missing it is the forgetting the app is meant to stop. Slack by default keeps thread replies out of the channel, and people often miss them.

### 18. Whether side discussions nest

Asked: can a Message inside a side discussion have its own side discussion?

Decided: no, there is one level only. Inside a side discussion a Message can still be a Reply, whole or quoting passages.

Why: with side discussions inside side discussions, finding where a new Message is gets hard fast. Slack and Discord both stop at one level.

### 19. Where Juggle's design starts from

Asked: should Juggle start from an existing design language (motion principles, type and style) or from scratch?

Decided: from scratch. Juggle is a whole new app, and no theme, colour, shape or motion has been agreed yet. Something from elsewhere comes over only where it makes sense. The design language is found by trying throwaway prototypes first.

## Prototypes

### Round 1: three directions for the main screen (2026-11-16)

Built in .scratch/juggle/prototypes (Vite, React, Tailwind, shadcn/ui with the nova preset), run with `npx vite` there and served on the Wi-Fi at port 5191. Made-up data, nothing saved. The bar at the top switches variants (?variant=A, B or C) and makes another Person write, in the open Thread or in another one.

- A, Messenger: close to WhatsApp Desktop. Thread list on the left, bubbles split left and right, warm colours, Figtree.
- B, Letters: editorial. A contents page of Threads, then one wide reading column of letters, serif (Newsreader), paper colours, side discussions open inline under a Message.
- C, Workspace: close to Slack. Dark and compact, flat Messages with avatars, a hover toolbar, side discussions in a panel on the right, Geist.

Every variant has: sending, replying to a whole Message, selecting passages to quote several in one Reply (quotes jump back to the original, which marks the passage answered), side discussions, editing and deleting own Messages, seen marks, unseen marks and starting a Thread. Motion is a placeholder fade and slide; motion is the second round.

Verdict so far: torn between B Letters and C Workspace. Letters is nice, but I want to switch between light and dark.

- D, Workspace with Letters, added to try both: Workspace's structure (the list beside the open Thread on the laptop, side discussions in a panel on the right, a toolbar on each Message) with Letters' reading (serif letter blocks in a column about 700px wide), in a light paper version and a warm dark version, switched from the moon and sun button beside the name. Interface labels are in Geist and everything written by a person is in Newsreader.

Feedback on D: better than the others. Read status is shown as icons, not words such as "Read by" and a name: one tick for sent, two ticks in the accent colour for read, with the words kept as a tooltip and for screen readers. Open: how to tell clearly whose Message is whose while keeping the letter style.

Noticed while trying D at phone size, not yet decided: a Thread opens at its first Message and does not move to a Message just sent, so on a phone a new Message is out of sight; the toolbar on each Message is always shown on the phone; the prototype's switcher bar covers the back button.

Whose Message is whose: four ways were built into D and tried (a coloured line down the left, indenting my letters, a faint tint behind each person's letters, and an initial). Decided: the initial. Each letter has a small circle with the person's initial in their own colour, in the left margin on a laptop and beside the name on a phone, and the name is in the same colour. The Person reading is blue and the other Person is terracotta. The other three were removed.

Reading long Messages: the serif feel is liked, but dense serif text is demanding on the eyes. Four ways to set it are built into D to compare, from the "Reading" bar: As now (Newsreader 19px), Airier (Newsreader a size smaller, more space between lines and paragraphs, softer ink, narrower column), Literata (a serif made for reading on screens, with the same extra space), and Sans body (titles and names stay serif, Messages in Geist). Verdict: waiting on trying them.

Reading verdict so far: Airier is liked, but its column (620px, about 70 characters a line, kept narrow because long lines tire the eye) looks horizontally compressed on a laptop. A "Width" bar is added to D on the laptop to try the column at its own width, 700px, 800px or 900px. Airier is now what D opens with.

Decided: Airier at an 800px column (700px was picked first, then changed to 800px). D's Airier option now uses 800px as its own width.

Unseen Messages: "4 new" in italic words was not prominent enough and added more text beside text. Four marks were built into D and tried (the words, a count in a filled circle, a dot, and a bar down the row's edge with the count). Decided: the count in a filled accent circle at the right of the Thread's row, with the title in bold and its last line less faded, and the Thread at the top of the list, where the newest Message already puts it. The side discussion link uses the same circle. The others were removed.

Chosen direction: D. Once an option is chosen, the others are removed from the prototype, because they go stale. Removed so far: variants A, B and C (their descriptions above are the record of them), the Reading switch (Airier kept) and the Width switch (800px kept). The prototype now opens straight on D at http://localhost:5191, with only the buttons that make another Person write on the bar.

Message menu: it repeated Reply and Side discussion, which already have icons in the toolbar, and it was drawn in shadcn's default style because it sits outside the themed part of the page. Decided: the "⋯" menu holds only Edit and Delete, each with an icon (a pencil, and a bin in a muted red), in the app's own colours, fonts and rounded shape, in light and dark. It shows only on my own Messages, since there is nothing in it for anyone else's.

Theme built the shadcn way: Juggle's colours are now shadcn's own theme values in index.css (background, foreground, card, popover, primary, destructive, border, sidebar and the rest, in :root and .dark), with each person's colour added beside them, so shadcn components take Juggle's look without overrides. Before this, D overrode components with its own variables, and its blue was named --accent, which is shadcn's colour for hovered menu items. Interface labels, the menu included, are in Geist (shadcn's font-sans) and everything people write is in Newsreader (font-serif). The page tells the browser when it is dark, so scrollbars are dark too. The dark side panel is a step lighter than the page so it stands apart.

Icons for the last two labels, to judge: the side discussion link is a small rounded pill with a speech icon and the count, plus the unseen badge when there is something new; "edited" is a small pencil after the time, with "Edited" as a tooltip.

Decided: the icons for side discussions (a pill with a speech icon, the count and the unseen badge) and for edits (a pencil after the time). Hovering the pencil says "Edited at" and the time it was edited, so each Message keeps when it was edited. No text box has hint text: the reply box, the side discussion box, the box after a quoted passage and the new Thread box are all empty until typed in. The message menu is in the serif, set without a further look.

### Design locked (2026-11-16)

The design of D, as it stands in .scratch/juggle/prototypes, is locked as Juggle's design. Motion is skipped for now and comes back later as its own round. Next is the tech stack and the whole software development lifecycle.

## Tech stack and lifecycle

The rough shape, agreed as a starting point: React, Vite, Tailwind and shadcn for the app, added to the phone's home screen for notifications; one Cloudflare Worker serving the app and its API; D1 for storage; Durable Objects holding WebSocket connections so Messages arrive live; web push for notifications; a sign-in that lets in more than one person; and a lifecycle of issues on a GitHub Projects board, CLAUDE.md, CONTEXT.md and ADRs, throwaway prototypes, a pyramid of tests, GitHub Actions testing, migrating and deploying, expand and contract, and review with /ponytail-review.

### T1. Whether Juggle runs on a laptop

Asked: does Juggle need to run entirely on one laptop, or only hosted on Cloudflare?

Decided: only hosted on Cloudflare. The laptop is for developing and testing, with `wrangler dev` running the same Worker, a local D1 and the Durable Objects. Recorded as docs/adr/0001-juggle-runs-only-on-cloudflare.md.

Testing happens in four places: fast tests on a D1 that lives in memory and is thrown away after each test; the whole app on the laptop with `wrangler dev`, served on the Wi-Fi so one person can be on the laptop and the other on a phone; Playwright browser tests against it with a fresh database each and two browser sessions as the two people; and CI running all of it before any deploy. What only shows on real Cloudflare (push to a phone, the real sign-in) may need a staging copy, decided later.

### T2. How people sign in

Asked: Cloudflare Access, Juggle's own sign-in, or a sign-in service such as Clerk or Auth0?

Decided: Cloudflare Access. People are added to its policy and sign in with Google or a one-time code by email; the free plan covers up to 50 people. Juggle keeps its own record of each person, and the rest of the app only asks "which person is making this request?" through one function, whose first answer reads the email from Access's token. So a sign-in page of Juggle's own can be added later, if Juggle widens to other people, by giving that function another answer, without changing the rest. To check before building: how Access's sign-in page behaves inside an iPhone home-screen app.

### T3. Who belongs to a Thread

Asked: does each Thread have its own list of people in it, as a WhatsApp group does, or does Juggle hold a conversation between a pair with Threads inside it?

Decided: each Thread has its own list of people, two or more. Each person sees every Thread they are in. Recorded in CONTEXT.md, with Person as a word.

Why: it keeps the number of people unfixed (decision 1) with nothing extra, and avoids a new concept of a pair. The cost accepted is that the list mixes Threads with different people once there are more than two; filtering it by person waits until that is needed.

### T4. How a Message reaches the other screens live

Asked: one Durable Object per Person, one per Thread, or polling?

Decided: one Durable Object per Person, holding a WebSocket connection to each of that Person's open screens, with hibernation. Recorded as docs/adr/0002-each-person-has-a-durable-object-that-passes-messages-to-their-screens.md. To check before building: hibernation's limits on the free plan.

### T5. Which devices get a push notification

Asked: push only when the Person has no screen open, always push to every device, or push unless that Thread is on screen?

Decided: notifications work as WhatsApp's do, following decision 4 (talking in Juggle feels like WhatsApp). A Person is notified only when they have no Juggle screen open and visible; a screen counts as open only while the browser reports it visible. The Person's Durable Object (T4) knows this. To check before building: exactly how WhatsApp quiets the phone while its desktop app is in use.

### T6. Where the code lives

Asked: a separate repo with no shared code, a package shared with another app, or one repo holding both?

Decided: a separate public repo, juggle, sharing no code with any other app. A piece from elsewhere that fits, such as the settled mark browser tests wait on or a GitHub Actions workflow, is copied in and becomes Juggle's own. Why: Juggle is a whole new app, and things from elsewhere come over only where they make sense, which copying decides piece by piece. Public, so no personal details are committed; hosting values live in git-ignored config and CI variables.

### T7. How Juggle is deployed

Asked: should CI deploy straight to the real Juggle, or to a staging copy first?

Decided: deploy by hand straight to the real Juggle, after the tests pass on the laptop. The CI pipeline that tests, migrates and deploys comes once things are locked in. No staging copy. A broken deploy is undone with `wrangler rollback`, which restores the code but not the database, so schema changes still have to leave the previous code working.

### T8. How a hand deploy keeps its steps in order

Asked: one deploy script, or the commands run one by one from a list?

Decided: one script, `npm run deploy`, that runs every test, then `wrangler d1 migrations apply --remote`, then deploys the Worker, stopping at the first step that fails. The CI pipeline later runs the same script. Every schema change is expand and contract (add the new shape, deploy code that uses it, remove the old shape in a later deploy), because `wrangler rollback` restores only the code, so the previous version must always work against the current database.

### T9. What runs the tests

Asked: @cloudflare/vitest-pool-workers, wrangler's getPlatformProxy, or only Playwright against `wrangler dev`?

Decided: @cloudflare/vitest-pool-workers for the fast tests, which run inside workerd with a fresh D1 and Durable Objects per test, so live delivery through a Person's Durable Object can be tested. Plain-function rules are still tested as plain functions. Playwright drives `wrangler dev` with two browser sessions, one per Person, checking only that the paths work end to end. Both run the same on the laptop (offline, no Cloudflare account) and later in CI. getPlatformProxy was not chosen because it does not run the Worker or the Durable Objects, and Juggle has no SQLite storage of its own to test that way. To check before building: whether hibernating WebSockets behave the same in its tests as on Cloudflare.

### T10. How a Message is sent

Asked: an HTTP request with an id the screen makes, or over the open WebSocket?

Decided: an HTTP request to the Worker carrying an id the screen made, so a retry with the same id is recognised and not saved twice. The screen shows the Message at once with a clock mark, which becomes one tick once the Worker has saved it to D1, and two ticks once read. The WebSocket only carries things outward to screens. The Worker checks the id is well formed and not already used by another Message. Why: making a request safe to repeat with a client-made id is the standard way to stop retries creating duplicates, and a WebSocket gives no acknowledgement of its own.

### T11. What a quote shows when the original changes

Asked: when a quoted Message is edited or deleted, does the quote keep the words, follow the current words, or keep them even after a delete?

Decided: a Reply keeps its own copy of each passage it quotes, with the id of the Message it came from. After an edit the quote keeps the words as they were answered, and tapping it goes to the original, which shows the edit pencil. After a delete the quote shows only that the Message was deleted, because deleting clears the copied passages too. Recorded in CONTEXT.md. Why: it keeps a reply readable after an edit and respects a delete, and it is where WhatsApp has ended up; WhatsApp's quotes long kept deleted words, criticised as a privacy loophole, until WhatsApp for iOS 25.12.73 began removing them.

### T12. When a Message counts as seen

Asked: when it has been on the Person's screen in a visible tab, when they open the Thread, or with a mark on each Message?

Decided: when the Message has been on the Person's screen in a visible tab, as WhatsApp does (decision 4). Juggle keeps one "seen up to" point for each Person in each Thread and in each side discussion, moved forward as Messages come into view (the browser's IntersectionObserver) and sent to the Worker. It gives the two ticks, the unseen badge, and where a Thread opens: at the first unseen Message, which fixes the prototype's problem of opening at the first Message.

### T13. What happens offline

Asked: sending waits and reading needs a connection, full offline as WhatsApp has, or nothing offline?

Decided: a Message written offline shows the clock mark and goes out by itself when the connection returns, safe to resend because of T10's ids. Waiting Messages are kept in the browser's storage so they survive the app being closed, so none is lost. Reading needs a connection; there is no stored copy of Threads on the device. Why: a written Message must never be lost, which T10 makes cheap, while reading offline is a whole feature to build once use shows the need.

### T14. How we learn something broke

Asked: Cloudflare's Workers Logs plus errors from the screen, an error service such as Sentry, or nothing?

Decided: Workers Logs, turned on with `observability` in the Wrangler config, keeping the Worker's logs and errors searchable in Cloudflare's dashboard. The screen reports its own uncaught errors, and sends that fail for good, to a small API endpoint that logs them in the same place. No alerts yet; add them if problems are being missed. To check before building: how long Workers Logs keeps logs on the free plan.

### T15. How conversations are protected from loss

Asked: D1's Time Travel only, Time Travel plus a copy taken by the deploy script, or a scheduled export to storage such as R2?

Decided: Time Travel (always on; any minute in the last 7 days on the free plan, 30 on paid, https://developers.cloudflare.com/d1/reference/time-travel/) plus a copy of the whole database taken by `npm run deploy` with `wrangler d1 export --remote` before it applies migrations, saved to a git-ignored folder on the laptop. So the deploy script's order is: tests, export, migrations, deploy. Every Person should know the copies hold their Messages too. Not covered: damage noticed after a week with no deploy in between; a scheduled export would close that if it ever matters.

### T16. How an open app gets a new version

Asked: always fetch the page fresh and cache only versioned files, cache the whole app with a "new version" prompt, or no caching?

Decided: the service worker (needed for push) fetches index.html from the network on every open and caches only the build's versioned files, whose names change with every build. A reopen always gets the latest version. A screen left open runs old code until reloaded, so every API change is expand and contract, as schema changes are (T8). Assumed, not checked: iOS home-screen apps can keep a page open for days.

Revised while planning push notifications (#13): the service worker only shows notifications and opens Juggle when one is tapped, and caches nothing. Caching was chosen for faster loads, not because push needs it; the browser already caches the versioned files, whose names change with every build, and Juggle does not open offline (#14). A service worker in front of every load could serve the wrong files after a deploy, a kind of fault that is hard to see and to test, so every load stays on the network as before.

Carried over as engineering practice, not asked: Markdown from Messages is sanitised before it is shown, since a Message is input from another Person; the project is run with issues on a GitHub Projects board, needs-triage until the user marks one ready, CLAUDE.md, docs/agents/, throwaway prototypes in .scratch/, and review with /ponytail-review.

### T17. What is built first

Asked: a thin slice through every layer first, then features one by one, or layer by layer?

Decided: a thin slice. The first issue is the smallest Juggle that works end to end and is deployed: both People sign in through Access, start a Thread, and send plain Messages that arrive live on each other's screens (T2, T3, T4, T10), with the deploy script (T8, T15), Workers Logs (T14) and the tests (T9). Each later issue adds one feature: seen marks and the badge, Markdown, Replies and quotes, side discussions, edit and delete, push notifications, the offline queue. Why: one path through every layer first finds integration problems early, and Juggle is usable after the first issue.

### To check before building

- How Access's sign-in page behaves inside an iPhone home-screen app (T2).
- WebSocket hibernation's limits on the free plan (T4), and whether it behaves the same in vitest-pool-workers tests (T9).
- Exactly how WhatsApp quiets the phone while its desktop app is in use (T5).
- How long Workers Logs keeps logs on the free plan (T14).
- Whether iOS home-screen apps keep a page open for days (T16).

### T9, changed after the checks in #2

Found: "Using WebSockets with Durable Objects is not supported with per-file storage isolation" in @cloudflare/vitest-pool-workers (https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/); the workaround shares one store across tests, against each test having its own.

Decided: the Durable Object's decisions, such as who gets a Message and whether a Person has a screen open, are plain functions tested in vitest with isolated storage. The real WebSocket path is checked only by the Playwright test with two sessions. Cost accepted: the hibernation wiring is checked only by the slower browser test.

### T18. Who is in a new Thread

Asked (in triaging #4): does a new Thread include everyone in Juggle, or does starting one ask who it is with?

Decided: everyone. A Person comes into Juggle's records the first time they sign in, since Access has already let them in, and a new Thread includes every Person; someone who signs in later is added to every Thread. Starting a Thread stays a title only (decision 10). Choosing people would need a new concept, such as the People each Person knows, so that they do not see everyone else in Juggle; it waits until there are People who should not all share Threads, tracked as issue #17. Each Thread keeps its own list of People (T3), so a choice added later changes only how the list is filled. Cost accepted: anyone added to the Access policy sees every Thread.

### T19. A beta copy for end-to-end tests (changes T7)

Asked (after #4): the automated tests cover the code but run against a local copy, so the hosted setup (real Access, the values in wrangler.jsonc, Cloudflare's own plumbing) was being checked by hand. Should end-to-end tests drive a real deployed Juggle?

Decided: yes, against a beta copy on its own address with its own Worker, D1 database and Access application, so tests never touch real data. This reverses T7's "no staging copy", whose reason was that nothing had shown a need; this is that need. Test People sign in with Access service tokens, one per Person, accepted as People only by beta's Worker and named in its config; the real Juggle accepts only real sign-ins. `npm run deploy` deploys to beta, runs the browser tests there through real Access, and deploys to the real Juggle only if they pass. Beta's database holds only test data, so each test empties it first and the tests run one at a time, leaving nothing behind and depending on no other test. A finished feature is handed over as fully tested; a person checks only what needs a real device or their judgement of how it looks and feels.
