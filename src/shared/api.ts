// The shapes the Worker's API sends and receives, shared by the Worker and the app.

// A Person gives their own name in Juggle, because sign-in tells Juggle only
// their email.
export type Name = {kind: 'none'} | {kind: 'given'; text: string};
export type Person = {id: string; email: string; name: Name};

export type LastMessage = {kind: 'none'} | {kind: 'message'; authorId: string; body: string; sentAt: number};

// How far a Person has seen in a Thread: up to the Message saved at sentAt.
// Messages are saved at strictly increasing times, so this marks one place.
export type SeenUpTo = {kind: 'nothing'} | {kind: 'message'; sentAt: number};
export type SeenPoint = {personId: string; upTo: SeenUpTo};
// A side discussion under a Message has a seen point of its own for each Person.
export type Side = {messageId: string; seen: SeenPoint[]};
// `unseen` counts the Messages others sent that the asking Person has not
// seen, in the main conversation and its side discussions; `seen` holds
// everyone's point in the main conversation and `sides` in each side discussion.
export type Thread = {id: string; title: string; startedAt: number; last: LastMessage; unseen: number; seen: SeenPoint[]; sides: Side[]};
export type SeeMessage = {messageId: string};

export type StartThread = {id: string; title: string};

// A Message is its own words and, for a Reply, quotes of earlier Messages in
// the same Thread, in the order they were written. A quote keeps its own copy
// of the words it quotes: a passage selected from the Message, or the whole
// of it.
// A quote of a Message that was later deleted keeps only which Message it was.
export type Part =
	| {kind: 'text'; text: string}
	| {kind: 'passage'; messageId: string; text: string}
	| {kind: 'whole'; messageId: string; text: string}
	| {kind: 'deleted'; messageId: string};
export type Quote = Extract<Part, {kind: 'passage' | 'whole'}>;
// What a screen sends: words, and quotes of Messages that are there.
export type SentPart = Exclude<Part, {kind: 'deleted'}>;
export type Edited = {kind: 'never'} | {kind: 'at'; at: number};
// Where in its Thread a Message is: the main conversation, or the side
// discussion under a Message in the main conversation.
export type Place = {kind: 'main'} | {kind: 'side'; messageId: string};
// body is the Message's own words, its text parts joined, as the list of
// Threads shows them. A deleted Message has no words and no parts.
// Whether a Message shows the preview of its first link. Its author can
// remove the preview for everyone.
export type PreviewShown = {kind: 'shown'} | {kind: 'removed'};
export type Message = {id: string; threadId: string; place: Place; authorId: string; body: string; parts: Part[]; sentAt: number; edited: Edited; deleted: boolean; preview: PreviewShown};

export type SendMessage = {id: string; parts: SentPart[]; place: Place};
export type EditMessage = {parts: SentPart[]};
// The words of a Message's text parts, as its body.
export const ownWords = (parts: Part[]) => parts.flatMap((p) => (p.kind === 'text' ? [p.text] : [])).join('\n\n');

export const titleLimit = 200;
export const nameLimit = 60;
// Long enough for the longest reply written after research, and small
// enough that a Thread's Messages still load quickly on every screen.
export const bodyLimit = 100000;
// How long a Message is, counting its own words and the words it quotes,
// which is what bodyLimit limits on the screen and in the Worker alike.
export const messageLength = (parts: Part[]) => parts.reduce((total, p) => total + (p.kind === 'deleted' ? 0 : p.text.length), 0);

// What a Person's open screens are told the moment something changes: a new
// Message, a change to the list of Threads, such as a new one, or a change
// to someone's name.
export type LiveEvent = {kind: 'message'; message: Message} | {kind: 'threads_changed'} | {kind: 'people_changed'};

// A link's preview, from the Open Graph tags its page publishes for this, or
// none when the page has no title or could not be read.
export type LinkPreview = {kind: 'found'; site: string; title: string; image: {kind: 'none'} | {kind: 'image'; url: string}} | {kind: 'none'};

// The first web address in a Message's words, which is the one it shows a
// preview of. The punctuation that ends a sentence or a Markdown link is not
// part of it, though brackets the address opens itself are.
export function firstLink(words: string): {kind: 'none'} | {kind: 'link'; url: string} {
	let url = /https?:\/\/[^\s<>"'\]]+/.exec(words)?.[0];
	if (url === undefined) return {kind: 'none'};
	const count = (text: string, c: string) => text.split(c).length - 1;
	while (/[.,!?;:'"]$/.test(url) || (url.endsWith(')') && count(url, ')') > count(url, '('))) url = url.slice(0, -1);
	return {kind: 'link', url};
}

// Whether an address is one a preview may be fetched from or point to.
export const onTheWeb = (address: string) => URL.canParse(address) && ['http:', 'https:'].includes(new URL(address).protocol);
