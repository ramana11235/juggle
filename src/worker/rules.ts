import {bodyLimit, messageLength, nameLimit, titleLimit, type EditMessage, type Place, type SeeMessage, type SentPart, type SendMessage, type StartThread} from '../shared/api';

// Ids are made by the screen, so the Worker accepts only the shape
// crypto.randomUUID makes.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type Checked<T> = {kind: 'ok'; value: T} | {kind: 'refused'; reason: string};

export function checkStartThread(body: unknown): Checked<StartThread> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const {id, title} = body as Record<string, unknown>;
	if (typeof id !== 'string' || !uuid.test(id)) return {kind: 'refused', reason: 'The id must be a UUID'};
	const checked = checkTitle(title);
	return checked.kind === 'ok' ? {kind: 'ok', value: {id, title: checked.value}} : checked;
}

export function checkRename(body: unknown): Checked<string> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	return checkTitle((body as Record<string, unknown>).title);
}

function checkTitle(title: unknown): Checked<string> {
	if (typeof title !== 'string') return {kind: 'refused', reason: 'The title must be text'};
	const trimmed = title.trim();
	if (trimmed === '') return {kind: 'refused', reason: 'The title is empty'};
	if (trimmed.length > titleLimit) return {kind: 'refused', reason: `The title is longer than ${titleLimit} characters`};
	return {kind: 'ok', value: trimmed};
}

// A screen sends either parts or, from screens made before Replies, a body
// alone, which is one part of text. Screens made before side discussions
// send no place, which is the main conversation.
export function checkSendMessage(body: unknown): Checked<SendMessage> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const {id, body: text, parts, place} = body as Record<string, unknown>;
	if (typeof id !== 'string' || !uuid.test(id)) return {kind: 'refused', reason: 'The id must be a UUID'};
	const checked = checkParts(parts === undefined && typeof text === 'string' ? [{kind: 'text', text}] : parts);
	if (checked.kind === 'refused') return checked;
	const where = place === undefined ? {kind: 'ok' as const, value: {kind: 'main' as const}} : checkPlace(place);
	return where.kind === 'ok' ? {kind: 'ok', value: {id, parts: checked.value, place: where.value}} : where;
}

function checkPlace(place: unknown): Checked<Place> {
	if (typeof place !== 'object' || place === null) return {kind: 'refused', reason: 'The place must be an object'};
	const {kind, messageId} = place as Record<string, unknown>;
	if (kind === 'main') return {kind: 'ok', value: {kind}};
	if (kind !== 'side') return {kind: 'refused', reason: 'A place is the main conversation or a side discussion'};
	if (typeof messageId !== 'string' || !uuid.test(messageId)) return {kind: 'refused', reason: 'A side discussion must name its Message by its UUID'};
	return {kind: 'ok', value: {kind, messageId}};
}

export function checkEditMessage(body: unknown): Checked<EditMessage> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const checked = checkParts((body as Record<string, unknown>).parts);
	return checked.kind === 'ok' ? {kind: 'ok', value: {parts: checked.value}} : checked;
}

// A Message's words and quotes, dropping blank words.
function checkParts(given: unknown): Checked<SentPart[]> {
	if (!Array.isArray(given) || given.length > partsLimit) return {kind: 'refused', reason: `The parts must be a list of at most ${partsLimit}`};
	const kept: SentPart[] = [];
	for (const part of given as unknown[]) {
		const checked = checkPart(part);
		if (checked.kind === 'refused') return checked;
		if (checked.value.kind !== 'text' || checked.value.text.trim() !== '') kept.push(checked.value);
	}
	if (kept.length === 0) return {kind: 'refused', reason: 'The Message is empty'};
	if (messageLength(kept) > bodyLimit) return {kind: 'refused', reason: `The Message is longer than ${bodyLimit} characters`};
	return {kind: 'ok', value: kept};
}

const partsLimit = 100;

// Only words and quotes of Messages that are there can be sent.
function checkPart(part: unknown): Checked<SentPart> {
	if (typeof part !== 'object' || part === null) return {kind: 'refused', reason: 'Each part must be an object'};
	const {kind, text, messageId} = part as Record<string, unknown>;
	if (typeof text !== 'string') return {kind: 'refused', reason: 'Each part must have text'};
	if (kind === 'text') return {kind: 'ok', value: {kind, text}};
	if (kind !== 'passage' && kind !== 'whole') return {kind: 'refused', reason: 'A part is text, a passage or a whole Message'};
	if (typeof messageId !== 'string' || !uuid.test(messageId)) return {kind: 'refused', reason: 'A quote must name a Message by its UUID'};
	if (text.trim() === '') return {kind: 'refused', reason: 'A quote is empty'};
	return {kind: 'ok', value: {kind, messageId, text}};
}

export function checkSeeMessage(body: unknown): Checked<SeeMessage> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const {messageId} = body as Record<string, unknown>;
	if (typeof messageId !== 'string' || !uuid.test(messageId)) return {kind: 'refused', reason: 'The messageId must be a UUID'};
	return {kind: 'ok', value: {messageId}};
}

export function checkName(body: unknown): Checked<string> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const {name} = body as Record<string, unknown>;
	if (typeof name !== 'string') return {kind: 'refused', reason: 'The name must be text'};
	const trimmed = name.trim();
	if (trimmed === '') return {kind: 'refused', reason: 'The name is empty'};
	if (trimmed.length > nameLimit) return {kind: 'refused', reason: `The name is longer than ${nameLimit} characters`};
	return {kind: 'ok', value: trimmed};
}

// What the screen reports about its own errors, kept short so a broken
// screen cannot fill the logs.
export function checkScreenError(body: unknown): Checked<{message: string; stack: string}> {
	if (typeof body !== 'object' || body === null) return {kind: 'refused', reason: 'Expected an object'};
	const {message, stack} = body as Record<string, unknown>;
	if (typeof message !== 'string') return {kind: 'refused', reason: 'The message must be text'};
	return {kind: 'ok', value: {message: message.slice(0, 2000), stack: typeof stack === 'string' ? stack.slice(0, 8000) : ''}};
}
