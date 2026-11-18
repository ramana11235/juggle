import type {EditMessage, LinkPreview, Message, Person, SendMessage, StartThread, Thread} from '../shared/api';
import {keep, kept} from './kept';
import {counted} from './settled';

const reloadedToSignIn = 'juggle-reloaded-to-sign-in';

// Reloading the page lets Access show its sign-in and then bring the Person
// back to the same address. Done once: if the page is still not signed in
// after reloading, as where no sign-in page is in front of Juggle, it stops.
function signInAgain() {
	if (kept(reloadedToSignIn, false)) return;
	keep(reloadedToSignIn, true);
	location.reload();
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
	// Cloudflare Access answers a call from someone whose sign-in has ended
	// with a redirect to its sign-in page, which a call cannot follow.
	const response = await fetch(path, {...init, redirect: 'manual', headers: {'Content-Type': 'application/json'}});
	if (response.type === 'opaqueredirect' || response.status === 401) {
		signInAgain();
		throw new Error(`${init?.method ?? 'GET'} ${path} needs signing in again`);
	}
	keep(reloadedToSignIn, undefined);
	if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status}`);
	// 204 answers carry no body.
	return (response.status === 204 ? undefined : await response.json()) as T;
}

// Every call counts towards the page's settled mark while it runs.
export const api = counted({
	me: () => call<Person>('/api/me'),
	giveName: (name: string) => call<Person>('/api/me/name', {method: 'PUT', body: JSON.stringify({name})}),
	people: () => call<Person[]>('/api/people'),
	threads: () => call<Thread[]>('/api/threads'),
	startThread: (start: StartThread) => call<Thread>('/api/threads', {method: 'POST', body: JSON.stringify(start)}),
	messages: (threadId: string) => call<Message[]>(`/api/threads/${threadId}/messages`),
	see: (threadId: string, messageId: string) => call<void>(`/api/threads/${threadId}/seen`, {method: 'POST', body: JSON.stringify({messageId})}),
	rename: (threadId: string, title: string) => call<{title: string}>(`/api/threads/${threadId}/title`, {method: 'PUT', body: JSON.stringify({title})}),
	edit: (message: Message, edit: EditMessage) => call<Message>(`/api/threads/${message.threadId}/messages/${message.id}`, {method: 'PUT', body: JSON.stringify(edit)}),
	remove: (message: Message) => call<Message>(`/api/threads/${message.threadId}/messages/${message.id}`, {method: 'DELETE'}),
	removePreview: (message: Message) => call<Message>(`/api/threads/${message.threadId}/messages/${message.id}/preview`, {method: 'DELETE'}),
	preview: (url: string) => call<LinkPreview>(`/api/previews?url=${encodeURIComponent(url)}`),
	send: (threadId: string, send: SendMessage) => call<Message>(`/api/threads/${threadId}/messages`, {method: 'POST', body: JSON.stringify(send)}),
});
