import type {LiveEvent} from '../shared/api';
import {checkEditMessage, checkName, checkRename, checkScreenError, checkSeeMessage, checkSendMessage, checkStartThread} from './rules';
import {deleteMessage, editMessage, everyone, giveName, joinPerson, messagesIn, peopleIn, renameThread, seeMessage, sendMessage, startThread, threadsOf} from './store';
import {localSignInCookie, whoIsAsking} from './who';

export {PersonScreens} from './screens';

const messagesPath = /^\/api\/threads\/([^/]+)\/messages$/;
const seenPath = /^\/api\/threads\/([^/]+)\/seen$/;
const titlePath = /^\/api\/threads\/([^/]+)\/title$/;
const messagePath = /^\/api\/threads\/([^/]+)\/messages\/([^/]+)$/;

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const route = `${request.method} ${url.pathname}`;

		if (route === 'GET /api/health') return Response.json({ok: true});

		// Development only: choose who you are, as Access would on Cloudflare.
		if (route === 'GET /api/local/sign-in' && env.SIGN_IN === 'local') {
			const email = url.searchParams.get('as') ?? '';
			return new Response(null, {
				status: 302,
				headers: {Location: '/', 'Set-Cookie': `${localSignInCookie}=${encodeURIComponent(email)}; Path=/; SameSite=Lax`},
			});
		}

		const who = await whoIsAsking(request, env);
		if (who.kind === 'nobody') return Response.json({error: 'Not signed in'}, {status: 401});
		const person = await joinPerson(env.DB, who.email, Date.now());

		switch (route) {
			case 'GET /api/live':
				if (request.headers.get('Upgrade') !== 'websocket') return Response.json({error: 'Expected a WebSocket'}, {status: 426});
				return env.SCREENS.get(env.SCREENS.idFromName(person.id)).fetch(request);
			case 'GET /api/me':
				return Response.json(person);
			case 'PUT /api/me/name': {
				const checked = checkName(await request.json().catch(() => null));
				if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
				const named = await giveName(env.DB, person, checked.value);
				const people = await everyone(env.DB);
				await Promise.all(people.map((p) => env.SCREENS.get(env.SCREENS.idFromName(p.id)).tell({kind: 'people_changed'})));
				return Response.json(named);
			}
			case 'GET /api/people':
				return Response.json(await everyone(env.DB));
			case 'GET /api/threads':
				return Response.json(await threadsOf(env.DB, person));
			case 'POST /api/threads': {
				const checked = checkStartThread(await request.json().catch(() => null));
				if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
				const result = await startThread(env.DB, person, checked.value, Date.now());
				if (result.kind === 'started') await tellEveryoneIn(env, result.thread.id, {kind: 'threads_changed'});
				return result.kind === 'started' ? Response.json(result.thread) : Response.json({error: 'That id is already used'}, {status: 409});
			}
			case 'POST /api/errors': {
				const checked = checkScreenError(await request.json().catch(() => null));
				if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
				console.error('Error on a screen', checked.value);
				return new Response(null, {status: 204});
			}
		}

		const threadId = messagesPath.exec(url.pathname)?.[1];
		if (threadId !== undefined && request.method === 'GET') {
			const result = await messagesIn(env.DB, person, threadId);
			return result.kind === 'messages' ? Response.json(result.messages) : Response.json({error: 'No such Thread'}, {status: 404});
		}
		if (threadId !== undefined && request.method === 'POST') {
			const checked = checkSendMessage(await request.json().catch(() => null));
			if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
			const result = await sendMessage(env.DB, person, threadId, checked.value, Date.now());
			switch (result.kind) {
				case 'sent':
					await tellEveryoneIn(env, threadId, {kind: 'message', message: result.message});
					await tellEveryoneIn(env, threadId, {kind: 'threads_changed'});
					return Response.json(result.message);
				case 'not_in_thread':
					return Response.json({error: 'No such Thread'}, {status: 404});
				case 'id_taken':
					return Response.json({error: 'That id is already used'}, {status: 409});
				case 'quotes_elsewhere':
					return Response.json({error: 'A quote is of a Message not in this Thread'}, {status: 400});
				case 'not_under_main':
					return Response.json({error: 'A side discussion can only be under a Message in the main conversation of this Thread'}, {status: 400});
			}
		}
		const [, inThread, messageId] = messagePath.exec(url.pathname) ?? [];
		if (messageId !== undefined && (request.method === 'PUT' || request.method === 'DELETE')) {
			let result;
			if (request.method === 'PUT') {
				const checked = checkEditMessage(await request.json().catch(() => null));
				if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
				result = await editMessage(env.DB, person, inThread, messageId, checked.value.parts, Date.now());
			} else result = await deleteMessage(env.DB, person, inThread, messageId, Date.now());
			switch (result.kind) {
				case 'changed':
					await tellEveryoneIn(env, inThread, {kind: 'message', message: result.message});
					await tellEveryoneIn(env, inThread, {kind: 'threads_changed'});
					return Response.json(result.message);
				case 'no_such_message':
					return Response.json({error: 'No such Message'}, {status: 404});
				case 'not_author':
					return Response.json({error: 'Only its author can change a Message'}, {status: 403});
				case 'deleted':
					return Response.json({error: 'That Message was deleted'}, {status: 409});
				case 'quotes_elsewhere':
					return Response.json({error: 'A quote is of a Message not in this Thread'}, {status: 400});
			}
		}
		const renamed = titlePath.exec(url.pathname)?.[1];
		if (renamed !== undefined && request.method === 'PUT') {
			const checked = checkRename(await request.json().catch(() => null));
			if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
			const result = await renameThread(env.DB, person, renamed, checked.value);
			if (result.kind === 'not_in_thread') return Response.json({error: 'No such Thread'}, {status: 404});
			await tellEveryoneIn(env, renamed, {kind: 'threads_changed'});
			return Response.json({title: checked.value});
		}
		const seenIn = seenPath.exec(url.pathname)?.[1];
		if (seenIn !== undefined && request.method === 'POST') {
			const checked = checkSeeMessage(await request.json().catch(() => null));
			if (checked.kind === 'refused') return Response.json({error: checked.reason}, {status: 400});
			const result = await seeMessage(env.DB, person, seenIn, checked.value.messageId);
			if (result.kind !== 'seen') return Response.json({error: 'No such Thread or Message'}, {status: 404});
			// Everyone's list refreshes, which carries the new seen point and unseen count.
			await tellEveryoneIn(env, seenIn, {kind: 'threads_changed'});
			return new Response(null, {status: 204});
		}
		return Response.json({error: 'Not found'}, {status: 404});
	},
} satisfies ExportedHandler<Env>;

// Tells the screens of everyone in a Thread, the sender's included, so their
// other screens hear too. It finishes before the answer goes back, so once a
// send has answered, every open screen has been told.
async function tellEveryoneIn(env: Env, threadId: string, event: LiveEvent): Promise<void> {
	const people = await peopleIn(env.DB, threadId);
	await Promise.all(people.map((id) => env.SCREENS.get(env.SCREENS.idFromName(id)).tell(event)));
}
