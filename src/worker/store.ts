import {ownWords, type Message, type Part, type Person, type SentPart, type SeenPoint, type SeenUpTo, type SendMessage, type Side, type StartThread, type Thread} from '../shared/api';

// Every saved moment is later than the last one saved, even within the same
// millisecond, so Threads and Messages are always in the exact order they
// were saved.
const after = (now: string) =>
	`MAX(${now}, COALESCE((SELECT MAX(at) FROM (SELECT MAX(sent_at) AS at FROM messages UNION ALL SELECT MAX(started_at) FROM threads)), 0) + 1)`;

// Finds the Person with this email, or adds them. A new Person is added to
// every Thread, because for now everyone in Juggle is in every Thread.
type PersonRow = {id: string; email: string; name: string | null};
const personFrom = (row: PersonRow): Person => ({id: row.id, email: row.email, name: row.name === null ? {kind: 'none'} : {kind: 'given', text: row.name}});

export async function joinPerson(db: D1Database, email: string, now: number): Promise<Person> {
	const found = await db.prepare('SELECT id, email, name FROM people WHERE email = ?').bind(email).first<PersonRow>();
	if (found) return personFrom(found);
	const id = crypto.randomUUID();
	// OR IGNORE: two first requests at once both get here, and only one adds them.
	await db.batch([
		db.prepare('INSERT OR IGNORE INTO people (id, email, joined_at) VALUES (?, ?, ?)').bind(id, email, now),
		db.prepare('INSERT OR IGNORE INTO thread_people (thread_id, person_id) SELECT t.id, p.id FROM threads t, people p WHERE p.email = ?').bind(email),
	]);
	return personFrom((await db.prepare('SELECT id, email, name FROM people WHERE email = ?').bind(email).first<PersonRow>())!);
}

export async function giveName(db: D1Database, person: Person, name: string): Promise<Person> {
	await db.prepare('UPDATE people SET name = ? WHERE id = ?').bind(name, person.id).run();
	return {...person, name: {kind: 'given', text: name}};
}

export async function everyone(db: D1Database): Promise<Person[]> {
	return (await db.prepare('SELECT id, email, name FROM people ORDER BY joined_at').all<PersonRow>()).results.map(personFrom);
}

type ThreadRow = {id: string; title: string; startedAt: number; lastAuthorId: string | null; lastBody: string | null; lastSentAt: number | null; unseen: number};
type SeenRow = {threadId: string; personId: string; upTo: number | null};
type SideSeenRow = SeenRow & {messageId: string};
const upToFrom = (upTo: number | null): SeenUpTo => (upTo === null ? {kind: 'nothing'} : {kind: 'message', sentAt: upTo});

// The Threads a Person is in, the one with the newest Message first; a Thread
// with no Messages yet counts from when it was started. A Message counts as
// unseen against the seen point of the place it is in.
export async function threadsOf(db: D1Database, person: Person): Promise<Thread[]> {
	const [threads, seen, sideSeen] = await db.batch([
		db
			.prepare(
				`SELECT t.id, t.title, t.started_at AS startedAt,
					m.author_id AS lastAuthorId, m.body AS lastBody, m.sent_at AS lastSentAt,
					(SELECT COUNT(*) FROM messages u WHERE u.thread_id = t.id AND u.author_id != tp.person_id
						AND u.sent_at > COALESCE(CASE WHEN u.side_of IS NULL
							THEN (SELECT up_to FROM seen WHERE thread_id = t.id AND person_id = tp.person_id)
							ELSE (SELECT up_to FROM side_seen WHERE side_of = u.side_of AND person_id = tp.person_id) END, 0)) AS unseen
				 FROM threads t
				 JOIN thread_people tp ON tp.thread_id = t.id AND tp.person_id = ?
				 LEFT JOIN messages m ON m.id = (SELECT id FROM messages WHERE thread_id = t.id ORDER BY sent_at DESC, id DESC LIMIT 1)
				 ORDER BY COALESCE(m.sent_at, t.started_at) DESC, t.id DESC`,
			)
			.bind(person.id),
		db
			.prepare(
				`SELECT everyone.thread_id AS threadId, everyone.person_id AS personId, s.up_to AS upTo
				 FROM thread_people mine
				 JOIN thread_people everyone ON everyone.thread_id = mine.thread_id
				 LEFT JOIN seen s ON s.thread_id = everyone.thread_id AND s.person_id = everyone.person_id
				 WHERE mine.person_id = ?
				 ORDER BY everyone.person_id`,
			)
			.bind(person.id),
		db
			.prepare(
				`SELECT parent.thread_id AS threadId, parent.id AS messageId, everyone.person_id AS personId, s.up_to AS upTo
				 FROM thread_people mine
				 JOIN messages parent ON parent.thread_id = mine.thread_id AND EXISTS (SELECT 1 FROM messages m WHERE m.side_of = parent.id)
				 JOIN thread_people everyone ON everyone.thread_id = mine.thread_id
				 LEFT JOIN side_seen s ON s.side_of = parent.id AND s.person_id = everyone.person_id
				 WHERE mine.person_id = ?
				 ORDER BY parent.sent_at, everyone.person_id`,
			)
			.bind(person.id),
	]);
	const points = new Map<string, SeenPoint[]>();
	for (const row of seen.results as SeenRow[]) points.set(row.threadId, [...(points.get(row.threadId) ?? []), {personId: row.personId, upTo: upToFrom(row.upTo)}]);
	const sides = new Map<string, Side[]>();
	for (const row of sideSeen.results as SideSeenRow[]) {
		const list = sides.get(row.threadId) ?? [];
		const point = {personId: row.personId, upTo: upToFrom(row.upTo)};
		const found = list.find((side) => side.messageId === row.messageId);
		if (found) found.seen.push(point);
		else list.push({messageId: row.messageId, seen: [point]});
		sides.set(row.threadId, list);
	}
	return (threads.results as ThreadRow[]).map((row) => ({
		id: row.id,
		title: row.title,
		startedAt: row.startedAt,
		last:
			row.lastAuthorId === null
				? {kind: 'none'}
				: {kind: 'message', authorId: row.lastAuthorId, body: row.lastBody!, sentAt: row.lastSentAt!},
		unseen: row.unseen,
		seen: points.get(row.id) ?? [],
		sides: sides.get(row.id) ?? [],
	}));
}

// Starts a Thread with everyone in Juggle in it. Starting the same id again
// is a retry and changes nothing; an id another Person used is refused.
export async function startThread(
	db: D1Database,
	person: Person,
	start: StartThread,
	now: number,
): Promise<{kind: 'started'; thread: Thread} | {kind: 'id_taken'}> {
	await db.batch([
		db.prepare(`INSERT OR IGNORE INTO threads (id, title, started_by, started_at) VALUES (?, ?, ?, ${after('?')})`).bind(start.id, start.title, person.id, now),
		db.prepare('INSERT OR IGNORE INTO thread_people (thread_id, person_id) SELECT t.id, p.id FROM threads t, people p WHERE t.id = ? AND t.started_by = ?').bind(start.id, person.id),
	]);
	const row = await db
		.prepare('SELECT id, title, started_at AS startedAt, started_by AS startedBy FROM threads WHERE id = ?')
		.bind(start.id)
		.first<{id: string; title: string; startedAt: number; startedBy: string}>();
	if (!row || row.startedBy !== person.id) return {kind: 'id_taken'};
	// Read back as the list reads it, so a new Thread has the same shape, seen points included.
	return {kind: 'started', thread: (await threadsOf(db, person)).find((t) => t.id === row.id)!};
}

async function isIn(db: D1Database, person: Person, threadId: string): Promise<boolean> {
	return (await db.prepare('SELECT 1 FROM thread_people WHERE thread_id = ? AND person_id = ?').bind(threadId, person.id).first()) !== null;
}

const messageColumns = 'id, thread_id AS threadId, side_of AS sideOf, author_id AS authorId, body, sent_at AS sentAt, edited_at AS editedAt, deleted_at AS deletedAt';
type MessageRow = Omit<Message, 'place' | 'parts' | 'edited' | 'deleted'> & {sideOf: string | null; editedAt: number | null; deletedAt: number | null};
type PartRow = {messageId: string; kind: SentPart['kind']; quotedId: string | null; text: string; quotedDeletedAt: number | null};
const partsOf = (where: string) =>
	`SELECT p.message_id AS messageId, p.kind, p.quoted_id AS quotedId, p.text, q.deleted_at AS quotedDeletedAt
	 FROM message_parts p LEFT JOIN messages q ON q.id = p.quoted_id WHERE ${where} ORDER BY p.message_id, p.position`;

// A Message with no rows of parts, such as one sent before Replies, is its
// body alone. A quote of a deleted Message says only which Message it was.
function withParts(rows: MessageRow[], partRows: PartRow[]): Message[] {
	const parts = new Map<string, Part[]>();
	for (const row of partRows) {
		const part: Part =
			row.kind === 'text'
				? {kind: 'text', text: row.text}
				: row.quotedDeletedAt !== null
					? {kind: 'deleted', messageId: row.quotedId!}
					: {kind: row.kind, messageId: row.quotedId!, text: row.text};
		parts.set(row.messageId, [...(parts.get(row.messageId) ?? []), part]);
	}
	return rows.map(({sideOf, editedAt, deletedAt, ...row}) => ({
		...row,
		place: sideOf === null ? {kind: 'main'} : {kind: 'side', messageId: sideOf},
		parts: deletedAt !== null ? [] : (parts.get(row.id) ?? [{kind: 'text', text: row.body}]),
		edited: editedAt === null ? {kind: 'never'} : {kind: 'at', at: editedAt},
		deleted: deletedAt !== null,
	}));
}

async function readMessage(db: D1Database, id: string): Promise<Message | undefined> {
	const [saved, parts] = await db.batch([db.prepare(`SELECT ${messageColumns} FROM messages WHERE id = ?`).bind(id), db.prepare(partsOf('p.message_id = ?')).bind(id)]);
	return withParts(saved.results as MessageRow[], parts.results as PartRow[])[0];
}

// The Messages in a Thread, oldest first, for someone in it.
export async function messagesIn(db: D1Database, person: Person, threadId: string): Promise<{kind: 'messages'; messages: Message[]} | {kind: 'not_in_thread'}> {
	if (!(await isIn(db, person, threadId))) return {kind: 'not_in_thread'};
	const [messages, parts] = await db.batch([
		db.prepare(`SELECT ${messageColumns} FROM messages WHERE thread_id = ? ORDER BY sent_at, id`).bind(threadId),
		db.prepare(partsOf('p.message_id IN (SELECT id FROM messages WHERE thread_id = ?)')).bind(threadId),
	]);
	return {kind: 'messages', messages: withParts(messages.results as MessageRow[], parts.results as PartRow[])};
}

// Whether every Message these parts quote is in the Thread.
async function quotesAreIn(db: D1Database, threadId: string, parts: SentPart[]): Promise<boolean> {
	const quoted = [...new Set(parts.flatMap((p) => (p.kind === 'text' ? [] : [p.messageId])))];
	if (quoted.length === 0) return true;
	const found = await db
		.prepare(`SELECT COUNT(*) AS n FROM messages WHERE thread_id = ? AND id IN (${quoted.map(() => '?').join(', ')})`)
		.bind(threadId, ...quoted)
		.first<{n: number}>();
	return found!.n === quoted.length;
}

// Rows for the parts of a Reply; a Message with no quotes has none. They are
// added only to this Person's own Message, so an id another Person used gets
// nothing added to it.
const partRows = (db: D1Database, person: Person, messageId: string, parts: SentPart[]) =>
	parts.some((p) => p.kind !== 'text')
		? parts.map((part, position) =>
				db
					.prepare(
						`INSERT OR IGNORE INTO message_parts (message_id, position, kind, quoted_id, text)
						 SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM messages WHERE id = ? AND author_id = ?)`,
					)
					.bind(messageId, position, part.kind, part.kind === 'text' ? null : part.messageId, part.text, messageId, person.id),
			)
		: [];

// Saves a Message in a Thread the Person is in, with its quotes, which must
// be of Messages in the same Thread. A side discussion can only be under a
// Message in the main conversation of the same Thread. Sending the same id again is a resend
// and gives back the Message already saved; an id used by another Message is
// refused.
export async function sendMessage(
	db: D1Database,
	person: Person,
	threadId: string,
	send: SendMessage,
	now: number,
): Promise<{kind: 'sent'; message: Message} | {kind: 'not_in_thread'} | {kind: 'id_taken'} | {kind: 'quotes_elsewhere'} | {kind: 'not_under_main'}> {
	if (!(await isIn(db, person, threadId))) return {kind: 'not_in_thread'};
	if (!(await quotesAreIn(db, threadId, send.parts))) return {kind: 'quotes_elsewhere'};
	const sideOf = send.place.kind === 'side' ? send.place.messageId : null;
	if (sideOf !== null && !(await db.prepare('SELECT 1 FROM messages WHERE id = ? AND thread_id = ? AND side_of IS NULL').bind(sideOf, threadId).first())) return {kind: 'not_under_main'};
	const known = await readMessage(db, send.id);
	if (known) return known.authorId === person.id && known.threadId === threadId ? {kind: 'sent', message: known} : {kind: 'id_taken'};
	// OR IGNORE: a resend racing the first send saves the Message once.
	await db.batch([
		db.prepare(`INSERT OR IGNORE INTO messages (id, thread_id, side_of, author_id, body, sent_at) VALUES (?, ?, ?, ?, ?, ${after('?')})`).bind(send.id, threadId, sideOf, person.id, ownWords(send.parts), now),
		...partRows(db, person, send.id, send.parts),
	]);
	const saved = (await readMessage(db, send.id))!;
	return saved.authorId === person.id && saved.threadId === threadId ? {kind: 'sent', message: saved} : {kind: 'id_taken'};
}

type Changed = {kind: 'changed'; message: Message} | {kind: 'no_such_message'} | {kind: 'not_author'} | {kind: 'deleted'};

// The Message with this id in this Thread, if this Person wrote it and it is still there.
async function ownMessage(db: D1Database, person: Person, threadId: string, id: string): Promise<Exclude<Changed, {kind: 'changed'}> | {kind: 'own'}> {
	const message = await readMessage(db, id);
	if (!message || message.threadId !== threadId || !(await isIn(db, person, threadId))) return {kind: 'no_such_message'};
	if (message.authorId !== person.id) return {kind: 'not_author'};
	return message.deleted ? {kind: 'deleted'} : {kind: 'own'};
}

// Replaces the words and quotes of a Person's own Message. Replies quoting it
// keep their own copies of the words they answered.
export async function editMessage(db: D1Database, person: Person, threadId: string, id: string, parts: SentPart[], now: number): Promise<Changed | {kind: 'quotes_elsewhere'}> {
	const own = await ownMessage(db, person, threadId, id);
	if (own.kind !== 'own') return own;
	if (!(await quotesAreIn(db, threadId, parts))) return {kind: 'quotes_elsewhere'};
	await db.batch([
		db.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?').bind(ownWords(parts), now, id),
		db.prepare('DELETE FROM message_parts WHERE message_id = ?').bind(id),
		...partRows(db, person, id, parts),
	]);
	return {kind: 'changed', message: (await readMessage(db, id))!};
}

// Deletes a Person's own Message: its words, its quotes, and every copy of its
// words in the Replies that quote it.
export async function deleteMessage(db: D1Database, person: Person, threadId: string, id: string, now: number): Promise<Changed> {
	const own = await ownMessage(db, person, threadId, id);
	if (own.kind !== 'own') return own;
	await db.batch([
		db.prepare("UPDATE messages SET body = '', deleted_at = ? WHERE id = ?").bind(now, id),
		db.prepare('DELETE FROM message_parts WHERE message_id = ?').bind(id),
		db.prepare("UPDATE message_parts SET text = '' WHERE quoted_id = ?").bind(id),
	]);
	return {kind: 'changed', message: (await readMessage(db, id))!};
}

// The ids of the People in a Thread, who are told when something in it changes.
export async function peopleIn(db: D1Database, threadId: string): Promise<string[]> {
	const {results} = await db.prepare('SELECT person_id AS id FROM thread_people WHERE thread_id = ? ORDER BY person_id').bind(threadId).all<{id: string}>();
	return results.map((row) => row.id);
}

// Moves a Person's seen point up to a Message, never back: their point in
// the main conversation, or in the side discussion the Message is in.
export async function seeMessage(
	db: D1Database,
	person: Person,
	threadId: string,
	messageId: string,
): Promise<{kind: 'seen'} | {kind: 'not_in_thread'} | {kind: 'no_such_message'}> {
	if (!(await isIn(db, person, threadId))) return {kind: 'not_in_thread'};
	const message = await db.prepare('SELECT sent_at AS sentAt, side_of AS sideOf FROM messages WHERE id = ? AND thread_id = ?').bind(messageId, threadId).first<{sentAt: number; sideOf: string | null}>();
	if (!message) return {kind: 'no_such_message'};
	const moved = message.sideOf === null
		? db.prepare('INSERT INTO seen (thread_id, person_id, up_to) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET up_to = MAX(up_to, excluded.up_to)').bind(threadId, person.id, message.sentAt)
		: db.prepare('INSERT INTO side_seen (side_of, person_id, up_to) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET up_to = MAX(up_to, excluded.up_to)').bind(message.sideOf, person.id, message.sentAt);
	await moved.run();
	return {kind: 'seen'};
}

// Renames a Thread for someone in it.
export async function renameThread(db: D1Database, person: Person, threadId: string, title: string): Promise<{kind: 'renamed'} | {kind: 'not_in_thread'}> {
	if (!(await isIn(db, person, threadId))) return {kind: 'not_in_thread'};
	await db.prepare('UPDATE threads SET title = ? WHERE id = ?').bind(title, threadId).run();
	return {kind: 'renamed'};
}
