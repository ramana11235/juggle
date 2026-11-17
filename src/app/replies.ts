import type {Message, Part, Quote, SentPart} from '../shared/api';

// What is being written in a Thread: words and quotes in order, always
// ending in words, so there is a box to write in after the last quote.
export type Draft = SentPart[];
export const emptyDraft: Draft = [{kind: 'text', text: ''}];

// Drafts kept by screens made before Replies are text alone.
export const draftFrom = (kept: string | Draft): Draft => (typeof kept === 'string' ? [{kind: 'text', text: kept}] : kept.length > 0 ? kept : emptyDraft);

// Adds a quote after what is written so far, dropping a box left empty.
export function withQuote(draft: Draft, quote: Quote): Draft {
	const last = draft.at(-1);
	const before = last?.kind === 'text' && last.text.trim() === '' ? draft.slice(0, -1) : draft;
	return [...before, quote, {kind: 'text', text: ''}];
}

// Takes a quote out, joining the words around it into one box.
export function withoutPart(draft: Draft, index: number): Draft {
	const rest = draft.filter((_, i) => i !== index);
	const joined: Draft = [];
	for (const part of rest) {
		const last = joined.at(-1);
		if (part.kind === 'text' && last?.kind === 'text') joined[joined.length - 1] = {kind: 'text', text: [last.text, part.text].filter((t) => t !== '').join('\n')};
		else joined.push(part);
	}
	return joined.length > 0 && joined.at(-1)!.kind === 'text' ? joined : [...joined, {kind: 'text', text: ''}];
}

// What is sent: the quotes and the words that are not blank.
export const toSend = (draft: Draft): SentPart[] => draft.filter((p) => p.kind !== 'text' || p.text.trim() !== '');

// The passages of each Message that Replies have quoted, so it can mark them
// as answered.
export function answeredPassages(messages: Message[]): Map<string, string[]> {
	const answered = new Map<string, string[]>();
	for (const part of messages.flatMap((m) => m.parts)) {
		if (part.kind === 'passage') answered.set(part.messageId, [...(answered.get(part.messageId) ?? []), part.text]);
	}
	return answered;
}

// A Message's parts as a draft to edit. Quotes of Messages since deleted
// cannot be sent again, so they are left out.
export function draftOf(parts: Part[]): Draft {
	const kept = parts.filter((p): p is SentPart => p.kind !== 'deleted');
	return kept.at(-1)?.kind === 'text' ? kept : [...kept, {kind: 'text', text: ''}];
}
