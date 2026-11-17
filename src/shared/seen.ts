import type {Message, SeenPoint, SeenUpTo} from './api';

const reaches = (upTo: SeenUpTo, sentAt: number) => upTo.kind === 'message' && upTo.sentAt >= sentAt;

// Two ticks: everyone in the Thread but the author has seen the Message.
export function seenByEveryoneElse(message: Message, seen: SeenPoint[]): boolean {
	const others = seen.filter((p) => p.personId !== message.authorId);
	return others.length > 0 && others.every((p) => reaches(p.upTo, message.sentAt));
}

export type OpenAt = {kind: 'message'; id: string} | {kind: 'newest'};

// Where a Thread opens for a Person: the first Message someone else sent that
// they have not seen, or the newest when they have seen them all.
export function firstUnseen(messages: Message[], personId: string, upTo: SeenUpTo): OpenAt {
	const first = messages.find((m) => m.authorId !== personId && !reaches(upTo, m.sentAt));
	return first ? {kind: 'message', id: first.id} : {kind: 'newest'};
}

// How many Messages others sent that the Person has not seen.
export const unseenCount = (messages: Message[], personId: string, upTo: SeenUpTo) => messages.filter((m) => m.authorId !== personId && !reaches(upTo, m.sentAt)).length;
