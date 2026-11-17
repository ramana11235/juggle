import type {LiveEvent} from '../shared/api';
import {begin} from './settled';

// Keeps one WebSocket open to the Person's Durable Object and hands each
// change it hears to `onEvent`. After a dropped connection it connects again,
// waiting longer each time it fails, and at once when the browser comes back
// online or the screen is shown again, then calls `onReconnect` so the screen
// can fetch whatever it missed. Connecting counts towards the page's settled
// mark, so a settled page is one that will hear the next change.
export function stayLive(onEvent: (event: LiveEvent) => void, onReconnect: () => void): () => void {
	let socket: WebSocket | undefined;
	let failures = 0;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let first = true;

	const connect = () => {
		if (stopped || (socket && socket.readyState <= WebSocket.OPEN)) return;
		clearTimeout(retry);
		const end = begin();
		const opened = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
		socket = opened;
		opened.onopen = () => {
			failures = 0;
			if (!first) onReconnect();
			first = false;
			end();
		};
		opened.onmessage = (message) => onEvent(JSON.parse(String(message.data)) as LiveEvent);
		opened.onclose = () => {
			end();
			if (stopped) return;
			failures++;
			retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** (failures - 1)));
		};
	};
	const whenBack = () => document.visibilityState === 'visible' && connect();

	connect();
	window.addEventListener('online', connect);
	document.addEventListener('visibilitychange', whenBack);
	return () => {
		stopped = true;
		clearTimeout(retry);
		window.removeEventListener('online', connect);
		document.removeEventListener('visibilitychange', whenBack);
		socket?.close();
	};
}
