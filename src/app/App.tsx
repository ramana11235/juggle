import {Menu} from '@base-ui/react/menu';
import {AlertCircle, ArrowLeft, Check, CheckCheck, Clock, MessageSquareText, Monitor, Moon, MoreHorizontal, Pencil, Plus, Quote as QuoteIcon, Sun, Trash2, X} from 'lucide-react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode} from 'react';
import {bodyLimit, firstLink, messageLength, nameLimit, ownWords, titleLimit, type LiveEvent, type Message, type Person, type Place, type Quote, type SentPart, type SeenPoint, type SeenUpTo, type Thread} from '../shared/api';
import {firstUnseen, seenByEveryoneElse, unseenCount} from '../shared/seen';
import {api} from './api';
import {keep, kept} from './kept';
import {LinkCard} from './LinkCard';
import {Markdown, PlainText} from './Markdown';
import {answeredPassages, draftFrom, draftOf, emptyDraft, toSend, withoutPart, withQuote, type Draft} from './replies';
import {cn} from './lib/utils';
import {button, iconButton, label} from './ui';
import {stayLive} from './live';
import {chooseTheme, themeChoice} from './theme';
import {tabIcon, tabTitle} from './unseenTab';
import {usePull} from './usePull';
import {Heading, Juggled} from './Mark';
import {begin, useSettledMark} from './settled';

// A Message as the screen shows it: saved, or sent from this screen and
// either still on its way or failed, in which case it can be sent again
// with the same id.
type Shown = {message: Message; delivery: {kind: 'saved'} | {kind: 'sending'} | {kind: 'failed'}};

const column = 'max-w-column';
const unsaved = 'juggle-unsaved-messages';

// The open Thread is at /t/<id>, and a side discussion open in it at /t/<id>/s/<Message id>.
function openFromAddress(address = location.pathname): {thread: string | undefined; side: string | undefined} {
	const [, thread, side] = /^\/t\/([^/]+)(?:\/s\/([^/]+))?$/.exec(address) ?? [];
	return {thread, side};
}

const wide = matchMedia('(min-width: 768px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Whether the screen is wide enough to show a side discussion beside its Thread.
function useWide() {
	return useSyncExternalStore(
		(changed) => {
			wide.addEventListener('change', changed);
			return () => wide.removeEventListener('change', changed);
		},
		() => wide.matches,
	);
}

export function App() {
	useSettledMark();
	const [me, setMe] = useState<Person>();
	const [people, setPeople] = useState<Person[]>([]);
	const [threads, setThreads] = useState<Thread[]>([]);
	const unseen = threads.reduce((total, thread) => total + thread.unseen, 0);
	useEffect(() => {
		document.title = tabTitle(unseen);
		document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href = tabIcon(unseen);
	}, [unseen]);
	const [open, setOpen] = useState(() => openFromAddress().thread);
	const [side, setSide] = useState(() => openFromAddress().side);
	const pull = usePull(open);
	// Messages sent from this screen live here, above the open Thread, so
	// moving to another Thread does not lose one still on its way.
	// Messages not yet saved survive a reload, coming back as not sent.
	const [outgoing, setOutgoing] = useState<Shown[]>(() =>
		// Kept by a screen made before Replies, a Message has its body alone,
		// and before side discussions, no place.
		kept<Message[]>(unsaved, []).map((message) => ({
			message: {...message, place: message.place ?? {kind: 'main'}, parts: message.parts ?? [{kind: 'text', text: message.body}], edited: message.edited ?? {kind: 'never'}, deleted: message.deleted ?? false},
			delivery: {kind: 'failed'},
		})),
	);
	useEffect(() => keep(unsaved, outgoing.filter((s) => s.delivery.kind !== 'saved').map((s) => s.message)), [outgoing]);
	// The saved Messages of each Thread opened so far, kept here so a Message
	// heard live reaches its Thread whether or not it is on screen.
	const [saved, setSaved] = useState<Record<string, Message[]>>({});
	const openRef = useRef(open);
	openRef.current = open;

	const loadMessages = useCallback(async (threadId: string) => {
		const messages = await api.messages(threadId);
		setSaved((all) => ({...all, [threadId]: messages}));
	}, []);
	const refreshThreads = useCallback(async () => setThreads(await api.threads()), []);
	// A Thread's Messages start loading in the same step that opens it, so
	// the page is never settled between showing a Thread and loading it.
	const show = useCallback(
		(address: string) => {
			const at = openFromAddress(address);
			if (at.thread && at.thread !== openRef.current) void loadMessages(at.thread);
			openRef.current = at.thread;
			setOpen(at.thread);
			setSide(at.side);
		},
		[loadMessages],
	);

	useEffect(() => {
		// The first screen shows once the Thread open at the start has loaded
		// too, so Juggled shows once while it loads, not again in the Thread.
		// If its Messages fail to load, it shows Juggled until they load again.
		const opened = openRef.current;
		void Promise.all([api.me(), api.people(), api.threads(), opened && loadMessages(opened).catch(() => {})]).then(([me, people, threads]) => {
			setMe(me);
			setPeople(people);
			setThreads(threads);
		});
		const onBack = () => show(location.pathname);
		window.addEventListener('popstate', onBack);
		const stop = stayLive(
			(event: LiveEvent) => {
				switch (event.kind) {
					case 'message':
						setSaved((all) => (all[event.message.threadId] ? {...all, [event.message.threadId]: withMessage(all[event.message.threadId], event.message)} : all));
						return;
					case 'threads_changed':
						void refreshThreads();
						return;
					case 'people_changed':
						void api.people().then(setPeople);
						return;
				}
			},
			() => {
				void refreshThreads();
				if (openRef.current) void loadMessages(openRef.current);
			},
		);
		return () => {
			window.removeEventListener('popstate', onBack);
			stop();
		};
	}, [loadMessages, refreshThreads, show]);


	// Opening a Thread or a side discussion adds a page to the history, marked
	// as opened from here. Leaving one goes back to where it was opened from,
	// as Back does, so Back afterwards does not open it again; a page reached
	// any other way, such as from a link, is replaced instead.
	const opening = (address: string) => {
		history.pushState({opened: true}, '', address);
		show(address);
	};
	const leaving = (address: string) => {
		if ((history.state as {opened?: boolean} | null)?.opened) history.back();
		else {
			history.replaceState(null, '', address);
			show(address);
		}
	};
	const go = (threadId: string) => opening(`/t/${threadId}`);
	// A side discussion opened while another is open takes its place in the history.
	const openSide = (messageId: string) => {
		const address = `/t/${open}/s/${messageId}`;
		if (side === undefined) return opening(address);
		history.replaceState(history.state, '', address);
		show(address);
	};
	const start = async (title: string) => {
		const id = crypto.randomUUID();
		await api.startThread({id, title});
		await refreshThreads();
		go(id);
	};
	const deliver = useCallback(async (shown: Shown) => {
		const {message} = shown;
		setOutgoing((all) => [...all.filter((s) => s.message.id !== message.id), {message, delivery: {kind: 'sending'}}]);
		try {
			const saved = await api.send(message.threadId, {id: message.id, parts: message.parts.filter((p): p is SentPart => p.kind !== 'deleted'), place: message.place});
			setOutgoing((all) => all.map((s) => (s.message.id === message.id ? {message: saved, delivery: {kind: 'saved'}} : s)));
		} catch (error) {
			setOutgoing((all) => all.map((s) => (s.message.id === message.id ? {...s, delivery: {kind: 'failed'}} : s)));
			throw error;
		}
	}, []);

	// An edited or deleted Message replaces the one shown.
	const change = async (changed: Promise<Message>) => {
		const message = await changed;
		setSaved((all) => ({...all, [message.threadId]: withMessage(all[message.threadId] ?? [], message)}));
	};
	const rename = async (threadId: string, title: string) => {
		await api.rename(threadId, title);
		await refreshThreads();
	};
	const giveName = async (name: string) => {
		setMe(await api.giveName(name));
		setPeople(await api.people());
	};

	if (!me)
		return (
			<div className="grid h-dvh place-items-center">
				<Juggled size={64} ground="var(--background)" />
			</div>
		);
	// Taken from the list of People, which every screen refetches when a name
	// changes, so a Person's other screens show their new name too.
	const own = people.find((p) => p.id === me.id)?.name ?? me.name;
	if (own.kind === 'none') return <AskName onGive={giveName} />;
	const ownName = own.text;
	const thread = threads.find((t) => t.id === open);
	return (
		<div className="flex h-dvh">
			<aside
				ref={pull.list}
				data-pulled={pull.pulled}
				data-dragging={pull.dragging}
				data-motion={pull.motion}
				onTransitionEnd={(event) => event.target === event.currentTarget && event.propertyName === 'transform' && pull.onSlid()}
				style={{'--pulled': pull.amount} as CSSProperties}
				className={cn('flex h-full flex-col bg-sidebar md:w-80 md:border-r md:border-border', thread ? 'pull-out' : 'w-full')}
			>
				<ThreadList
					threads={threads}
					people={people}
					open={open}
					onOpen={(id) => {
						pull.putAway();
						go(id);
					}}
					onStart={start}
				/>
				<YourName name={ownName} onChange={giveName} />
			</aside>
			{thread && (
				<div
					data-testid="behind-the-list"
					aria-hidden
					onClick={pull.putAway}
					className="fixed inset-0 z-30 bg-black md:hidden"
					style={{opacity: pull.amount * 0.35, pointerEvents: pull.amount > 0 ? 'auto' : 'none', transition: pull.dragging ? 'none' : 'opacity 300ms'}}
				/>
			)}
			<main ref={pull.area} style={{touchAction: 'pan-y pinch-zoom'}} className={cn('h-full min-w-0 flex-1 max-md:motion-safe:slide-in', thread ? 'block' : 'hidden md:block')}>
				{thread && (
					<Reading
						key={thread.id}
						thread={thread}
						me={me}
						people={people}
						loading={!(thread.id in saved)}
						saved={saved[thread.id] ?? []}
						outgoing={outgoing.filter((s) => s.message.threadId === thread.id)}
						side={side}
						onSide={openSide}
						onCloseSide={() => leaving(`/t/${thread.id}`)}
						onBack={() => leaving('/')}
						onRename={(title) => rename(thread.id, title)}
						onEdit={(message, parts) => change(api.edit(message, {parts}))}
						onDelete={(message) => change(api.remove(message))}
						onRemovePreview={(message) => change(api.removePreview(message))}
						onSend={(parts, place) => void deliver({message: {id: crypto.randomUUID(), threadId: thread.id, place, authorId: me.id, body: ownWords(parts), parts, sentAt: Date.now(), edited: {kind: 'never'}, deleted: false, preview: {kind: 'shown'}}, delivery: {kind: 'sending'}})}
						onResend={(shown) => void deliver(shown)}
					/>
				)}
			</main>
		</div>
	);
}

function ThreadList({threads, people, open, onOpen, onStart}: {threads: Thread[]; people: Person[]; open: string | undefined; onOpen: (id: string) => void; onStart: (title: string) => Promise<void>}) {
	const [adding, setAdding] = useState(false);
	const [title, setTitle] = useState('');
	return (
		<>
			<div className="px-5 pt-5 pb-4">
				<Heading ground="var(--sidebar)" />
			</div>
			<div className={cn('flex items-center justify-between px-5 pb-1', label)}>
				Threads
				<button onClick={() => setAdding(true)} aria-label="New Thread" className={cn(iconButton, 'rounded-box p-1 hover:bg-accent')}>
					<Plus className="size-4" />
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-2 pb-16">
				{adding && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const trimmed = title.trim();
							setTitle('');
							setAdding(false);
							if (trimmed) void onStart(trimmed);
						}}
					>
						<input
							autoFocus
							aria-label="Title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							onBlur={() => !title && setAdding(false)}
							className="mb-1 h-10 w-full rounded-box bg-accent px-3 font-serif text-compact italic optical-centre outline-none"
						/>
					</form>
				)}
				<ul aria-label="Threads">
					{threads.map((thread) => (
						<li key={thread.id}>
							<button
								onClick={() => onOpen(thread.id)}
								className={cn('flex w-full items-center gap-3 rounded-box px-3 py-3 text-left transition-colors', open === thread.id ? 'bg-background shadow-sm' : 'hover:bg-accent')}
							>
								<span className="min-w-0 flex-1">
									<span className={cn('block truncate font-serif text-compact leading-snug', thread.unseen > 0 && 'font-semibold')}>{thread.title}</span>
									<span className={cn('mt-1 block truncate font-serif text-note italic', thread.unseen > 0 ? 'opacity-60' : 'opacity-60')}>
										{thread.last.kind === 'message' ? (
											<>
												{nameOf(people, thread.last.authorId)}: <PlainText text={thread.last.body} />
											</>
										) : (
											'Not begun yet'
										)}
									</span>
								</span>
								{thread.unseen > 0 && (
									<span aria-label={`${thread.unseen} unseen`} className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-2 text-label font-semibold text-primary-foreground tabular-nums">
										{thread.unseen}
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			</div>
		</>
	);
}

function Reading({thread, me, people, loading, saved, outgoing, side, onSide, onCloseSide, onBack, onRename, onEdit, onDelete, onRemovePreview, onSend, onResend}: {
	thread: Thread;
	me: Person;
	people: Person[];
	// Whether the Thread's Messages are still loading the first time it opens.
	loading: boolean;
	saved: Message[];
	outgoing: Shown[];
	side: string | undefined;
	onSide: (messageId: string) => void;
	onCloseSide: () => void;
	onBack: () => void;
	onRename: (title: string) => Promise<void>;
	onEdit: (message: Message, parts: SentPart[]) => Promise<void>;
	onDelete: (message: Message) => Promise<void>;
	onRemovePreview: (message: Message) => Promise<void>;
	onSend: (parts: SentPart[], place: Place) => void;
	onResend: (shown: Shown) => void;
}) {
	// A Message this screen sent and the Worker saved takes its place among
	// the saved ones, by when it was saved, so a Message never shows twice and
	// never below an answer to it. Those still on their way come last.
	// The copy fetched or heard from the Worker wins, as it carries any edit since.
	const fetched = new Set(saved.map((m) => m.id));
	const savedHere = outgoing.filter((s) => s.delivery.kind === 'saved' && !fetched.has(s.message.id)).map((s) => s.message);
	const inOrder = [...saved, ...savedHere].sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id));
	// A Message heard live before its send has answered is already saved.
	const shown: Shown[] = [...inOrder.map((message) => ({message, delivery: {kind: 'saved'} as const})), ...outgoing.filter((s) => s.delivery.kind !== 'saved' && !fetched.has(s.message.id))];
	const sideOf = (id: string) => shown.filter((s) => s.message.place.kind === 'side' && s.message.place.messageId === id);
	const sidePoints = (id: string) => thread.sides.find((x) => x.messageId === id)?.seen ?? [];
	const common: Common = {
		me,
		people,
		answered: answeredPassages(shown.map((s) => s.message)),
		// Quotes of a Message deleted since they were loaded show it as deleted too.
		deleted: new Set(shown.filter((s) => s.message.deleted).map((s) => s.message.id)),
		onEdit,
		onDelete,
		onRemovePreview,
		onResend,
	};
	const sentIn = (place: Place) => outgoing.filter((s) => samePlace(s.message.place, place)).length;
	const parent = side === undefined ? undefined : shown.find((s) => s.message.id === side && s.message.place.kind === 'main');
	// A side discussion just closed stays on screen while it slides away,
	// unless the device asks for reduced motion, and is gone once it has.
	const [closing, setClosing] = useState<{kind: 'none'} | {kind: 'closing'; shown: Shown}>({kind: 'none'});
	const lastParent = useRef(parent);
	useLayoutEffect(() => {
		const was = lastParent.current;
		lastParent.current = parent;
		if (parent) setClosing({kind: 'none'});
		else if (was && !reducedMotion.matches) setClosing({kind: 'closing', shown: was});
		// Only opening and closing matter, not each new copy of the same Message.
	}, [parent?.message.id]);
	const panel = parent ?? (closing.kind === 'closing' ? closing.shown : undefined);
	// On a narrow screen the side discussion covers the Thread, so the Thread's
	// Messages are not being looked at.
	const wideScreen = useWide();
	return (
		<div className="flex h-full">
			<div className="h-full min-w-0 flex-1">
				<Conversation
					{...common}
					threadId={thread.id}
					label="Messages"
					loading={loading}
					shown={shown.filter((s) => s.message.place.kind === 'main')}
					points={thread.seen}
					looking={!parent || wideScreen}
					sentHere={sentIn({kind: 'main'})}
					draftKey={`juggle-draft-${thread.id}`}
					top={
						<>
							<button onClick={onBack} className={cn('mb-6 flex items-center gap-2 md:hidden', label)}>
								<ArrowLeft className="size-4" /> Threads
							</button>
							<Title title={thread.title} onRename={onRename} />
						</>
					}
					sides={(message) => {
						const messages = sideOf(message.id);
						const mine = sidePoints(message.id).find((p) => p.personId === me.id)?.upTo ?? {kind: 'nothing'};
						const saved = messages.filter((s) => s.delivery.kind === 'saved').map((s) => s.message);
						return {count: messages.length, unseen: unseenCount(saved, me.id, mine), onOpen: () => onSide(message.id)};
					}}
					onSend={(parts) => onSend(parts, {kind: 'main'})}
					className={cn('mx-auto px-6 pt-6 pb-12 md:pt-16 md:pl-16', column)}
					footClassName={cn('mx-auto w-full md:px-6 md:pl-16', column)}
				/>
			</div>
			{panel && (
				<section
					aria-label="Side discussion"
					inert={!parent}
					className={cn(
						'fixed inset-0 z-40 bg-card md:static md:z-auto md:w-panel md:shrink-0 md:overflow-hidden md:border-l md:border-border',
						parent ? 'max-md:motion-safe:slide-in md:motion-safe:drawer-in' : 'max-md:slide-out md:drawer-out',
					)}
					onAnimationEnd={(event) => {
						if (!parent && event.target === event.currentTarget) setClosing({kind: 'none'});
					}}
				>
					{/* On a laptop the panel opens from no width to its own, so its contents keep their width and do not rewrap as it opens. */}
					<div className="flex h-full flex-col md:w-panel">
						<div className="flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))] pb-3">
							<span className={label}>Side discussion</span>
							<button onClick={onCloseSide} aria-label="Close" className={cn(iconButton, 'opacity-60 hover:opacity-100')}>
								<X className="size-4" />
							</button>
						</div>
						<div className="min-h-0 flex-1">
							<Conversation
								key={panel.message.id}
								{...common}
								threadId={thread.id}
								label="Messages in the side discussion"
								loading={false}
								shown={sideOf(panel.message.id)}
								points={sidePoints(panel.message.id)}
								looking
								sentHere={sentIn({kind: 'side', messageId: panel.message.id})}
								draftKey={`juggle-draft-${thread.id}-${panel.message.id}`}
								parent={panel.message}
								onSend={(parts) => onSend(parts, {kind: 'side', messageId: panel.message.id})}
								className="px-5 pt-3 pb-6"
								footClassName=""
								small
							/>
						</div>
					</div>
				</section>
			)}
		</div>
	);
}

const samePlace = (a: Place, b: Place) => (a.kind === 'main' ? b.kind === 'main' : b.kind === 'side' && a.messageId === b.messageId);

// What every conversation in a Thread shares: who is reading, and what
// happens to a Message changed or sent again.
type Common = {
	me: Person;
	people: Person[];
	answered: Map<string, string[]>;
	deleted: Set<string>;
	onEdit: (message: Message, parts: SentPart[]) => Promise<void>;
	onDelete: (message: Message) => Promise<void>;
	onRemovePreview: (message: Message) => Promise<void>;
	onResend: (shown: Shown) => void;
};
type SideMark = {count: number; unseen: number; onOpen: () => void};

// One place in a Thread, its main conversation or a side discussion: its
// Messages, with its own seen point, and a box to write in with its own draft.
function Conversation({me, people, answered, deleted, onEdit, onDelete, onRemovePreview, onResend, threadId, label, loading, shown, points, looking, sentHere, draftKey, top, parent, sides, onSend, className, footClassName, small = false}: Common & {
	threadId: string;
	label: string;
	// Whether the Messages are still loading, shown as Juggled in their place.
	loading: boolean;
	shown: Shown[];
	points: SeenPoint[];
	looking: boolean;
	sentHere: number;
	draftKey: string;
	top?: ReactNode;
	// The Message a side discussion was started under, shown above it as a quote.
	parent?: Message;
	sides?: (message: Message) => SideMark;
	onSend: (parts: SentPart[]) => void;
	className: string;
	footClassName: string;
	small?: boolean;
}) {
	const saved = shown.filter((s) => s.delivery.kind === 'saved').map((s) => s.message);
	const scroller = useSeen(threadId, points, me, saved, looking, shown.length, sentHere);
	const [draft, setDraft] = useDraft(draftKey);
	const quote = (q: Quote) => setDraft((d) => withQuote(d, q));
	const [selected, clearSelected] = usePassageSelection(scroller);
	// The Message a tapped quote went to, highlighted until another is tapped.
	const [highlighted, setHighlighted] = useState<string>();
	const goTo = (id: string) => {
		const element = scroller.current?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
		element?.scrollIntoView({block: 'center'});
		// The same Message highlighted again keeps its attribute, so its flash
		// is restarted by hand: clearing the animation and reading the layout
		// makes the browser start it afresh.
		if (element && highlighted === id) {
			element.style.animation = 'none';
			void element.offsetHeight;
			element.style.animation = '';
		}
		setHighlighted(id);
	};
	const letter = (s: Shown, seen: boolean) => (
		<Letter
			key={s.message.id}
			shown={s}
			mine={s.message.authorId === me.id}
			seen={seen}
			name={nameOf(people, s.message.authorId)}
			answered={answered.get(s.message.id) ?? []}
			highlighted={highlighted === s.message.id}
			small={small}
			side={sides?.(s.message)}
			onReply={() => quote({kind: 'whole', messageId: s.message.id, text: s.message.body})}
			onGoTo={goTo}
			deletedQuotes={deleted}
			onEdit={(parts) => onEdit(s.message, parts)}
			onDelete={() => onDelete(s.message)}
			onRemovePreview={() => onRemovePreview(s.message)}
			onResend={() => onResend(s)}
		/>
	);
	return (
		<div className="flex h-full flex-col">
			<div ref={scroller} className="flex-1 overflow-y-auto">
				<div className={className}>
					{top}
					{parent && (
						<blockquote className="mb-8 border-l-2 border-primary pl-4 font-serif text-compact italic opacity-60">
							{parent.deleted ? 'This message was deleted' : <Markdown text={parent.body} className="md" />}
						</blockquote>
					)}
					{loading ? (
						<div className="grid place-items-center py-16">
							<Juggled size={44} ground="var(--background)" />
						</div>
					) : (
						<ol aria-label={label} className={cn('flex flex-col', small ? 'gap-8' : 'gap-12')}>
							{shown.map((s) => letter(s, s.delivery.kind === 'saved' && seenByEveryoneElse(s.message, points)))}
						</ol>
					)}
				</div>
			</div>
			<div className={cn('px-4 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]', footClassName)}>
				<Composer
					draft={draft}
					onChange={setDraft}
					onSend={() => {
						onSend(toSend(draft));
						setDraft(emptyDraft);
					}}
				/>
			</div>
			{selected && (
				<button
					// Keeps the selection while pressing, so the passage can still be read.
					onPointerDown={(event) => event.preventDefault()}
					onClick={() => {
						quote({kind: 'passage', messageId: selected.messageId, text: selected.text});
						clearSelected();
					}}
					className="fixed z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-note text-background shadow-lg"
					style={{left: Math.max(70, Math.min(selected.x, window.innerWidth - 70)), top: selected.y + 10}}
				>
					Reply to this
				</button>
			)}
		</div>
	);
}

// Opens a conversation at the first Message the Person has not seen, then
// moves their seen point there forward as Messages others sent come onto the
// screen in a visible tab, while they are looking at it. Returns the ref for
// the scrolling element.
function useSeen(threadId: string, points: SeenPoint[], me: Person, saved: Message[], looking: boolean, shownCount: number, sentCount: number) {
	const scroller = useRef<HTMLDivElement>(null);
	// Whether the view is at the newest Message, so it follows new ones, as
	// chat apps do, while a Person reading further up is left where they are.
	const atNewest = useRef(false);
	const counts = useRef({shownCount, sentCount});
	const pointAtOpen = useRef<SeenUpTo>(pointOf(points, me));
	const observer = useRef<IntersectionObserver>(undefined);
	const onScreen = useRef(new Set<string>());
	const firstLook = useRef(new Map<Element, () => void>());
	const watched = useRef(new WeakSet<Element>());
	const reported = useRef(0);
	const latest = useRef({threadId, points, me, saved, looking});
	latest.current = {threadId, points, me, saved, looking};

	const report = useCallback(() => {
		const {threadId, points, me, saved, looking} = latest.current;
		if (document.visibilityState !== 'visible' || !looking) return;
		const point = pointOf(points, me);
		const newest = saved.filter((m) => m.authorId !== me.id && onScreen.current.has(m.id)).at(-1);
		if (!newest || newest.sentAt <= Math.max(reported.current, point.kind === 'message' ? point.sentAt : 0)) return;
		const before = reported.current;
		reported.current = newest.sentAt;
		// Forgotten when it fails, so the next look reports it again.
		api.see(threadId, newest.id).catch(() => (reported.current = before));
	}, []);

	useLayoutEffect(() => {
		const element = scroller.current;
		if (!element || saved.length === 0) return;
		const grew = shownCount > counts.current.shownCount;
		const sentHere = sentCount > counts.current.sentCount;
		counts.current = {shownCount, sentCount};
		if (observer.current && ((grew && atNewest.current) || sentHere)) element.scrollTop = element.scrollHeight;
		if (!observer.current) {
			const at = firstUnseen(saved, me.id, pointAtOpen.current);
			if (at.kind === 'message') element.querySelector(`[data-message-id="${at.id}"]`)?.scrollIntoView({block: 'start'});
			else element.scrollTop = element.scrollHeight;
			const follow = () => (atNewest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40);
			follow();
			element.addEventListener('scroll', follow);
			observer.current = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						const id = (entry.target as HTMLElement).dataset.messageId!;
						if (entry.isIntersecting) onScreen.current.add(id);
						else onScreen.current.delete(id);
					}
					report();
					// Each Letter's first look counts towards the settled mark, so a
					// settled page has reported everything it shows.
					for (const entry of entries) {
						firstLook.current.get(entry.target)?.();
						firstLook.current.delete(entry.target);
					}
				},
				{root: element},
			);
		}
		for (const letter of element.querySelectorAll('[data-message-id]')) {
			if (watched.current.has(letter)) continue;
			watched.current.add(letter);
			firstLook.current.set(letter, begin());
			observer.current.observe(letter);
		}
	});

	useEffect(() => {
		if (looking) report();
	}, [looking, report]);

	useEffect(() => {
		document.addEventListener('visibilitychange', report);
		return () => {
			document.removeEventListener('visibilitychange', report);
			// Forgotten whole, so a conversation shown again, as React does once
			// in development, watches every Message on screen from the start.
			observer.current?.disconnect();
			observer.current = undefined;
			watched.current = new WeakSet();
			for (const end of firstLook.current.values()) end();
			firstLook.current.clear();
		};
	}, [report]);

	return scroller;
}

function pointOf(points: SeenPoint[], me: Person): SeenUpTo {
	return points.find((p) => p.personId === me.id)?.upTo ?? {kind: 'nothing'};
}

// A Message in the main conversation can have a side discussion under it,
// shown as how many Messages it holds and how many of those are unseen.
function Letter({shown, mine, seen, name, answered, highlighted, small, side, deletedQuotes, onReply, onGoTo, onEdit, onDelete, onRemovePreview, onResend}: {
	shown: Shown;
	mine: boolean;
	seen: boolean;
	name: string;
	answered: string[];
	highlighted: boolean;
	small: boolean;
	side: SideMark | undefined;
	deletedQuotes: Set<string>;
	onReply: () => void;
	onGoTo: (id: string) => void;
	onEdit: (parts: SentPart[]) => Promise<void>;
	onDelete: () => Promise<void>;
	onRemovePreview: () => Promise<void>;
	onResend: () => void;
}) {
	const {message, delivery} = shown;
	const link = firstLink(message.body);
	const initial = initialOf(name);
	const who = mine ? 'var(--me)' : 'var(--them)';
	const tint = mine ? 'var(--me-tint)' : 'var(--them-tint)';
	const [editing, setEditing] = useState<Draft>();
	const [failed, setFailed] = useState(false);
	const time = (at: number) => new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
	return (
		<li className="group relative rounded-box motion-safe:fade-in" data-message-id={message.id} data-highlighted={highlighted}>
			{!small && (
				<span data-initial className="absolute top-0 -left-12 hidden size-8 place-items-center rounded-full text-note font-semibold md:grid" style={{background: tint, color: who}}>
					{initial}
				</span>
			)}
			<header className="mb-2 flex items-baseline gap-3">
				<span className={cn('grid size-6 shrink-0 place-items-center self-center rounded-full text-label font-semibold', !small && 'md:hidden')} style={{background: tint, color: who}}>
					{initial}
				</span>
				<span className="text-label font-semibold tracking-label uppercase" style={{color: who}}>
					{name}
				</span>
				<span className="text-label opacity-60">{time(message.sentAt)}</span>
				{message.edited.kind === 'at' && !message.deleted && (
					<span title={`Edited at ${time(message.edited.at)}`} aria-label={`Edited at ${time(message.edited.at)}`} className="self-center opacity-60">
						<Pencil className="size-3.5" />
					</span>
				)}
				{mine && !message.deleted && <DeliveryMark delivery={delivery} seen={seen} onResend={onResend} />}
				{failed && <NotSaved />}
			</header>
			{message.deleted ? (
				<p className="font-serif text-reading italic opacity-60 md:text-reading-wide">This message was deleted</p>
			) : editing ? (
				<Composer
					draft={editing}
					onChange={setEditing}
					action="Save"
					onCancel={() => setEditing(undefined)}
					onSend={() => {
						setFailed(false);
						onEdit(toSend(editing)).then(
							() => setEditing(undefined),
							() => setFailed(true),
						);
					}}
				/>
			) : (
				<div className="flex flex-col gap-3">
					{message.parts.map((part, i) =>
						part.kind === 'text' ? (
							<Markdown key={i} text={part.text} answered={answered} className="md md-airy font-serif text-reading leading-reading tracking-reading opacity-86 md:text-reading-wide" />
						) : (
							<button
								key={i}
								onClick={() => onGoTo(part.messageId)}
								aria-label={`Go to the quoted Message: ${part.kind === 'deleted' || deletedQuotes.has(part.messageId) ? 'This message was deleted' : part.text}`}
								className={cn('border-l-2 border-primary pl-4 text-left font-serif text-compact leading-7 italic opacity-60 hover:opacity-100', part.kind === 'whole' && 'line-clamp-3')}
							>
								{part.kind === 'deleted' || deletedQuotes.has(part.messageId) ? 'This message was deleted' : part.kind === 'whole' ? <PlainText text={part.text} /> : part.text}
							</button>
						),
					)}
					{link.kind === 'link' && message.preview.kind === 'shown' && delivery.kind === 'saved' && (
						<LinkCard url={link.url} mine={mine} onRemove={() => void onRemovePreview().catch(() => setFailed(true))} />
					)}
				</div>
			)}
			{side && side.count > 0 && (
				<button
					onClick={side.onOpen}
					aria-label={`Open side discussion, ${side.count} ${side.count === 1 ? 'message' : 'messages'}`}
					className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-note font-medium text-primary tabular-nums transition-colors hover:border-primary/40 hover:bg-accent"
				>
					<MessageSquareText className="size-4" />
					{side.count}
					{side.unseen > 0 && (
						<span aria-label={`${side.unseen} unseen`} className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-2 text-label font-semibold text-primary-foreground">
							{side.unseen}
						</span>
					)}
				</button>
			)}
			{delivery.kind === 'saved' && !message.deleted && !editing && (
				<div className="absolute -top-2 right-0 flex rounded-full border border-border bg-card shadow-sm md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
					<button onClick={onReply} aria-label="Reply" className={cn(iconButton, 'p-2 opacity-60 hover:opacity-100')}>
						<QuoteIcon className="size-4" />
					</button>
					{side && (
						<button onClick={side.onOpen} aria-label="Side discussion" className={cn(iconButton, 'p-2 opacity-60 hover:opacity-100')}>
							<MessageSquareText className="size-4" />
						</button>
					)}
					{mine && (
						<Menu.Root>
							<Menu.Trigger aria-label="More actions" className={cn(iconButton, 'p-2 opacity-60 hover:opacity-100')}>
								<MoreHorizontal className="size-4" />
							</Menu.Trigger>
							<Menu.Portal>
								<Menu.Positioner align="end" sideOffset={4} className="z-50">
									<Menu.Popup className="min-w-36 rounded-box border border-border bg-card p-1 font-serif shadow-lg outline-none">
										<Menu.Item
											onClick={() => {
												setFailed(false);
												setEditing(draftOf(message.parts));
											}}
											className="flex cursor-default items-center gap-2 rounded-box px-3 py-2 outline-none data-highlighted:bg-accent"
										>
											<Pencil className="size-4" /> Edit
										</Menu.Item>
										<Menu.Item
											onClick={() => {
												setFailed(false);
												onDelete().catch(() => setFailed(true));
											}}
											className="flex cursor-default items-center gap-2 rounded-box px-3 py-2 text-destructive outline-none data-highlighted:bg-accent"
										>
											<Trash2 className="size-4" /> Delete
										</Menu.Item>
									</Menu.Popup>
								</Menu.Positioner>
							</Menu.Portal>
						</Menu.Root>
					)}
				</div>
			)}
		</li>
	);
}

function DeliveryMark({delivery, seen, onResend}: {delivery: Shown['delivery']; seen: boolean; onResend: () => void}) {
	switch (delivery.kind) {
		case 'sending':
			return (
				<span title="Sending" aria-label="Sending" className="self-center opacity-60">
					<Clock className="size-3.5" />
				</span>
			);
		case 'saved':
			if (seen)
				return (
					<span title="Seen" aria-label="Seen" className="self-center text-primary">
						<CheckCheck className="size-3.5" />
					</span>
				);
			return (
				<span title="Sent" aria-label="Sent" className="self-center opacity-60">
					<Check className="size-3.5" />
				</span>
			);
		case 'failed':
			return (
				<button onClick={onResend} title="Not sent, send again" aria-label="Not sent, send again" className={cn(iconButton, 'self-center text-destructive')}>
					<AlertCircle className="size-3.5" />
				</button>
			);
	}
}

// What is being written in a conversation, kept so it survives a reload,
// such as to sign in again.
function useDraft(key: string) {
	const [draft, setDraft] = useState<Draft>(() => draftFrom(kept<string | Draft>(key, emptyDraft)));
	useEffect(() => keep(key, toSend(draft).length === 0 ? undefined : draft), [key, draft]);
	return [draft, setDraft] as const;
}

// A passage selected in a Message, with where it is on screen.
type Selected = {messageId: string; text: string; x: number; y: number};
function usePassageSelection(root: React.RefObject<HTMLElement | null>) {
	const [selected, setSelected] = useState<Selected>();
	useEffect(() => {
		const onChange = () => {
			const selection = getSelection();
			const text = selection?.toString().trim();
			if (!selection || !text || selection.rangeCount === 0) return setSelected(undefined);
			const node = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
			const message = node?.closest('[data-message-id]');
			if (!message || !root.current?.contains(message)) return setSelected(undefined);
			const box = selection.getRangeAt(0).getBoundingClientRect();
			setSelected({messageId: message.getAttribute('data-message-id')!, text, x: box.left + box.width / 2, y: box.bottom});
		};
		document.addEventListener('selectionchange', onChange);
		return () => document.removeEventListener('selectionchange', onChange);
	}, [root]);
	const clear = () => {
		getSelection()?.removeAllRanges();
		setSelected(undefined);
	};
	return [selected, clear] as const;
}

// Writes a Message, or with Save and Cancel, edits one.
function Composer({draft, onChange, onSend, action = 'Send', onCancel}: {draft: Draft; onChange: (draft: Draft) => void; onSend: () => void; action?: 'Send' | 'Save'; onCancel?: () => void}) {
	// Editing starts in its first box; writing, in the box after a quote just added.
	const firstWords = draft.findIndex((p) => p.kind === 'text');
	// A Message too long for the Worker is never sent, so it cannot fail after Send.
	const sendable = toSend(draft).length > 0 && messageLength(draft) <= bodyLimit;
	const send = () => sendable && onSend();
	return (
		<div className="flex items-end gap-3 rounded-box border border-border bg-card px-4 py-3 focus-within:border-primary/50">
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{draft.map((part, i) =>
					part.kind === 'text' ? (
						<Words
							key={i}
							text={part.text}
							focus={onCancel ? i === firstWords : i > 0}
							onChange={(text) => onChange(draft.map((p, j) => (j === i ? {kind: 'text', text} : p)))}
							onSend={send}
						/>
					) : (
						<div key={i} className="relative border-l-2 border-primary pr-12 pl-3 md:pr-6 font-serif text-compact italic opacity-60">
							<span className="line-clamp-3">{part.kind === 'whole' ? <PlainText text={part.text} /> : part.text}</span>
							<button onClick={() => onChange(withoutPart(draft, i))} aria-label="Remove quote" className={cn(iconButton, 'absolute top-0 right-0 opacity-60 hover:opacity-100')}>
								<X className="size-3.5" />
							</button>
						</div>
					),
				)}
			</div>
			<div className="flex shrink-0 gap-2">
				{onCancel && (
					<button onClick={onCancel} className={button.quiet}>
						Cancel
					</button>
				)}
				<button disabled={!sendable} onClick={send} className={button.primary}>
					{action}
				</button>
			</div>
		</div>
	);
}

function Words({text, focus, onChange, onSend}: {text: string; focus: boolean; onChange: (text: string) => void; onSend: () => void}) {
	// Sized from its text, so it shrinks back once a Message is sent.
	const box = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => autoGrow(box.current), [text]);
	return (
		<textarea
			rows={1}
			aria-label="Message"
			autoFocus={focus}
			value={text}
			ref={box}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSend();
			}}
			className="w-full resize-none bg-transparent font-serif text-reading leading-7 outline-none md:text-reading-wide"
		/>
	);
}

function autoGrow(element: HTMLTextAreaElement | null) {
	if (!element) return;
	element.style.height = 'auto';
	element.style.height = `${Math.min(element.scrollHeight, 280)}px`;
}

// Only a Person who has given their name can write, so the email shows only
// for someone Juggle does not know yet.
function nameOf(people: Person[], id: string): string {
	const person = people.find((p) => p.id === id);
	if (!person) return '?';
	return person.name.kind === 'given' ? person.name.text : person.email;
}

// Spread by characters, so a name starting with an emoji keeps it whole.
function NotSaved() {
	return (
		<span title="Not saved" aria-label="Not saved" className="text-destructive">
			<AlertCircle className="size-4" />
		</span>
	);
}

const initialOf = (name: string) => ([...name][0] ?? '').toUpperCase();

function AskName({onGive}: {onGive: (name: string) => Promise<void>}) {
	const [text, setText] = useState('');
	const [failed, setFailed] = useState(false);
	return (
		<div className="grid h-dvh place-items-center px-6">
			<form
				className="flex w-full max-w-panel flex-col gap-6"
				onSubmit={(event) => {
					event.preventDefault();
					if (!text.trim()) return;
					setFailed(false);
					onGive(text.trim()).catch(() => setFailed(true));
				}}
			>
				<Heading ground="var(--background)" />
				<label className="flex flex-col gap-3">
					<span className="font-serif text-title leading-tight font-medium tracking-tight">What's your name?</span>
					<input autoFocus maxLength={nameLimit} value={text} onChange={(event) => setText(event.target.value)} className="h-13 rounded-box border border-border bg-card px-4 font-serif text-reading-wide optical-centre outline-none focus:border-primary/50" />
				</label>
				<div className="flex items-center justify-end gap-3">
					{failed && <NotSaved />}
					<button disabled={!text.trim()} className={button.primary}>
						Continue
					</button>
				</div>
			</form>
		</div>
	);
}

const titleClass = 'font-serif text-title leading-tight font-medium tracking-tight md:text-title-wide';

// The open Thread's title, with a menu beside it that holds Rename. Renaming
// turns the title into a text box: Enter saves and Escape or leaving it cancels.
function Title({title, onRename}: {title: string; onRename: (title: string) => Promise<void>}) {
	const [editing, setEditing] = useState(false);
	const [text, setText] = useState(title);
	const [failed, setFailed] = useState(false);
	const box = useRef<HTMLInputElement>(null);
	return (
		<div className="mb-8 flex items-start gap-3 md:-ml-12">
			{editing ? (
				<form
					className="flex w-full items-center gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (!text.trim()) return;
						setFailed(false);
						onRename(text.trim()).then(
							() => setEditing(false),
							() => setFailed(true),
						);
					}}
				>
					<input
						ref={box}
						autoFocus
						aria-label="Thread title"
						maxLength={titleLimit}
						value={text}
						onChange={(event) => setText(event.target.value)}
						onBlur={() => setEditing(false)}
						onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
						className={cn(titleClass, '-mx-2 w-full rounded-box bg-accent px-2 outline-none')}
					/>
					{failed && <NotSaved />}
				</form>
			) : (
				<h2 className={titleClass}>{title}</h2>
			)}
			{!editing && (
				<Menu.Root>
					<Menu.Trigger aria-label="Thread menu" className={cn(iconButton, 'mt-3 ml-auto rounded-box p-1 opacity-60 hover:opacity-100')}>
						<MoreHorizontal className="size-4" />
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Positioner align="end" sideOffset={4} className="z-50">
							<Menu.Popup finalFocus={box} className="w-40 rounded-box border border-border bg-card p-1 shadow-lg outline-none">
								<Menu.Item
									onClick={() => {
										setText(title);
										setFailed(false);
										setEditing(true);
									}}
									className="w-full cursor-default rounded-box px-3 py-2 text-left font-serif outline-none data-highlighted:bg-accent"
								>
									Rename
								</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			)}
		</div>
	);
}

// The Person's own name at the foot of the list of Threads, which opens a box to change it.
function YourName({name, onChange}: {name: string; onChange: (name: string) => Promise<void>}) {
	const [changing, setChanging] = useState(false);
	const [text, setText] = useState(name);
	const [failed, setFailed] = useState(false);
	return (
		<>
			<button
				aria-label={`Your name, ${name}`}
				onClick={() => {
					setText(name);
					setFailed(false);
					setChanging(true);
				}}
				className="mx-2 mb-[max(8px,env(safe-area-inset-bottom))] flex items-center gap-3 rounded-box px-3 py-3 text-left hover:bg-accent"
			>
				<span className="grid size-8 shrink-0 place-items-center rounded-full text-note font-semibold" style={{background: 'var(--me-tint)', color: 'var(--me)'}}>
					{initialOf(name)}
				</span>
				<span className="truncate font-serif text-compact">{name}</span>
			</button>
			{changing && (
				<div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6" onClick={() => setChanging(false)}>
					<form
						role="dialog"
						aria-label="Settings"
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => event.key === 'Escape' && setChanging(false)}
						onSubmit={(event) => {
							event.preventDefault();
							if (!text.trim()) return;
							setFailed(false);
							onChange(text.trim()).then(
								() => setChanging(false),
								() => setFailed(true),
							);
						}}
						className="flex w-full max-w-panel flex-col gap-4 rounded-box bg-background p-6 shadow-xl"
					>
						{/* One row per setting, its title on the left and its control on the right. */}
						<label className="flex items-center justify-between gap-4">
							<span className="font-serif text-compact">Your name</span>
							<input
								autoFocus
								maxLength={nameLimit}
								value={text}
								onChange={(event) => setText(event.target.value)}
								className={cn(setting, 'rounded-box border border-border bg-card px-3 font-serif text-compact optical-centre outline-none focus:border-primary/50')}
							/>
						</label>
						<div className="flex items-center justify-between gap-4">
							<span className="font-serif text-compact">Theme</span>
							<ThemeSwitch />
						</div>
						<div className="mt-2 flex items-center justify-end gap-2">
							{failed && <NotSaved />}
							<button type="button" onClick={() => setChanging(false)} className={button.quiet}>
								Cancel
							</button>
							<button disabled={!text.trim()} className={button.primary}>
								Save
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}

// The size of each setting's control, so the rows line up: tall enough on a
// phone for the theme switch's 44px buttons.
const setting = 'h-13 w-37 min-w-0 md:h-11';

// Light, dark or the same as the device. Juggle changes the moment one is
// picked, and the choice is kept on this device.
function ThemeSwitch() {
	const [choice, setChoice] = useState(themeChoice);
	const choices = [
		{choice: 'light', name: 'Light', Icon: Sun},
		{choice: 'dark', name: 'Dark', Icon: Moon},
		{choice: 'device', name: 'Same as the device', Icon: Monitor},
	] as const;
	return (
		<div role="group" aria-label="Theme" className={cn(setting, 'flex items-center justify-between rounded-full border border-border p-1')}>
			{choices.map(({choice: c, name, Icon}) => (
				<button
					key={c}
					type="button"
					aria-label={name}
					aria-pressed={choice === c}
					onClick={() => {
						chooseTheme(c);
						setChoice(c);
					}}
					className={cn(iconButton, 'size-9 rounded-full', choice === c ? 'bg-card shadow-sm' : 'opacity-60 hover:opacity-100')}
				>
					<Icon className="size-4" />
				</button>
			))}
		</div>
	);
}

// Adds a Message heard live, once, in the order Messages were saved.
// Adds a Message heard live, or replaces it when it was edited or deleted.
function withMessage(messages: Message[], message: Message): Message[] {
	return [...messages.filter((m) => m.id !== message.id), message].sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id));
}
