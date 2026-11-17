# Each Person has a Durable Object that passes Messages to their screens

A Message must appear on the other Person's screens the moment it is sent. Each open copy of Juggle keeps one WebSocket connection to its Person's own Durable Object, named by that Person. Sending a Message saves it to D1, and the Worker then tells the Durable Object of each Person in the Thread, which passes it to every screen that Person has open. One connection per screen keeps the whole screen current, the open Thread, the unseen badges and new Threads alike, and the Durable Object knows whether its Person has any screen open, which decides whether to send them a push notification. The Durable Objects use WebSocket hibernation, so connections that are open but quiet cost almost nothing. D1 stays the record; a screen that reconnects fetches what it missed from the API.

## Considered options

- One Durable Object per Thread. Rejected because the list of Threads, with its badges and new Threads, would need a second connection or polling.
- Polling every few seconds. Rejected because Messages would arrive late in a chat, and polling uses up the free plan's requests while nobody is writing.

## Consequences

- Sending a Message makes one call to a Durable Object per Person in its Thread.
- To check before building: WebSocket hibernation's limits on the free plan.
