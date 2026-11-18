import {useRef, useState, type PointerEvent} from 'react';
import {endsOpen, type Pulled} from './pull';

// On a phone, a swipe right on a Thread pulls the list of Threads out over
// it, following the finger one to one; letting go finishes the move or puts
// the list back (see pull.ts). A swipe that starts mostly up or down is left
// to scroll the Thread. When the device asks for reduced motion the list does
// not follow the finger, and appears or stays away once it is let go.
// The list is out over one Thread, so opening any other Thread, by any way,
// finds it put away. `amount` is how far out the list is, from 0 to 1 of its
// own width.
export function usePull(thread: string | undefined) {
	const [out, setOut] = useState<{kind: 'away'} | {kind: 'over'; thread: string}>({kind: 'away'});
	const pulled: Pulled = out.kind === 'over' && out.thread === thread ? 'open' : 'closed';
	// The list slides only once a finger has moved it, and is still again once
	// it has slid away, so opening a Thread never shows it leaving.
	const [motion, setMotion] = useState<'still' | 'sliding'>('still');
	const [dragged, setDragged] = useState<{kind: 'none'} | {kind: 'dragging'; amount: number}>({kind: 'none'});
	const list = useRef<HTMLElement>(null);
	const finger = useRef<{kind: 'none'} | {kind: 'down'; x: number; y: number; axis: 'unknown' | 'across' | 'along'; lastX: number; lastAt: number; speed: number}>({kind: 'none'});

	const onPhone = () => matchMedia('(width < 48rem)').matches;
	const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const width = () => list.current?.getBoundingClientRect().width || window.innerWidth;
	const from = pulled === 'open' ? 1 : 0;

	const handlers = {
		onPointerDown: (event: PointerEvent) => {
			if (event.pointerType === 'mouse' || !onPhone()) return;
			finger.current = {kind: 'down', x: event.clientX, y: event.clientY, axis: 'unknown', lastX: event.clientX, lastAt: performance.now(), speed: 0};
		},
		onPointerMove: (event: PointerEvent) => {
			const down = finger.current;
			if (down.kind !== 'down') return;
			const dx = event.clientX - down.x;
			const dy = event.clientY - down.y;
			if (down.axis === 'unknown' && Math.hypot(dx, dy) > 8) down.axis = Math.abs(dx) > Math.abs(dy) ? 'across' : 'along';
			if (down.axis !== 'across') return;
			const now = performance.now();
			down.speed = (event.clientX - down.lastX) / Math.max(1, now - down.lastAt);
			down.lastX = event.clientX;
			down.lastAt = now;
			setMotion('sliding');
			setDragged({kind: 'dragging', amount: still() ? from : Math.min(1, Math.max(0, from + dx / width()))});
		},
		onPointerUp: (event: PointerEvent) => {
			const down = finger.current;
			finger.current = {kind: 'none'};
			if (down.kind !== 'down' || down.axis !== 'across') return;
			setDragged({kind: 'none'});
			setOut(thread !== undefined && endsOpen({from: pulled, moved: event.clientX - down.x, width: width(), speed: down.speed}) ? {kind: 'over', thread} : {kind: 'away'});
		},
		onPointerCancel: () => {
			finger.current = {kind: 'none'};
			setDragged({kind: 'none'});
		},
	};

	return {
		pulled,
		dragging: dragged.kind === 'dragging',
		motion,
		onSlid: () => pulled === 'closed' && dragged.kind === 'none' && setMotion('still'),
		amount: dragged.kind === 'dragging' ? dragged.amount : from,
		list,
		handlers,
		putAway: () => setOut({kind: 'away'}),
	};
}
