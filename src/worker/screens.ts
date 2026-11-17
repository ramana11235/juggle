import {DurableObject} from 'cloudflare:workers';
import type {LiveEvent} from '../shared/api';

// Each Person has one of these, named by their id. Every screen they have
// open keeps a WebSocket to it, and it passes on what it is told to all of
// them. The sockets are hibernatable, so open but quiet screens cost
// almost nothing. The runtime answers a screen's close by itself, so there is
// no close handler.
export class PersonScreens extends DurableObject<Env> {
	async fetch(): Promise<Response> {
		const [screen, here] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(here);
		return new Response(null, {status: 101, webSocket: screen});
	}

	async tell(event: LiveEvent): Promise<void> {
		const sent = JSON.stringify(event);
		for (const socket of this.ctx.getWebSockets()) {
			// A screen that has just gone away can refuse; the others still hear.
			try {
				socket.send(sent);
			} catch {}
		}
	}
}
