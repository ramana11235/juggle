import {useEffect, useRef, useState} from 'react';
import {endsOpen, type Pulled} from './pull';

// On a phone, a swipe right on a Thread pulls the list of Threads out over
// it, following the finger one to one; letting go finishes the move or puts
// the list back (see pull.ts). A swipe that starts mostly up or down is left
// to scroll the Thread. Once a swipe is going sideways the phone is stopped
// from scrolling for the rest of the touch, since a slow swipe drifts and the
// phone would otherwise take the touch over as a scroll. The finger is
// followed with touch events, which keep coming while a phone scrolls, where
// pointer events are cancelled. When the device asks for reduced motion the list does
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

	// The latest of what the listeners read, so they are added once per area
	// and never act on a stale render.
	const now = useRef({pulled, from, setOut, thread});
	now.current = {pulled, from, setOut, thread};

	// The Thread's area is only on screen once Juggle has loaded, so the
	// listeners are added when it appears.
	const [area, setArea] = useState<HTMLElement | null>(null);
	useEffect(() => {
		const element = area;
		if (!element) return;
		const start = (event: TouchEvent) => {
			const touch = event.touches[0];
			if (event.touches.length !== 1 || !onPhone() || scrollsSideways(event.target, element)) return;
			finger.current = {kind: 'down', x: touch.clientX, y: touch.clientY, axis: 'unknown', lastX: touch.clientX, lastAt: performance.now(), speed: 0};
		};
		const move = (event: TouchEvent) => {
			const down = finger.current;
			const touch = event.touches[0];
			if (down.kind !== 'down' || !touch) return;
			const dx = touch.clientX - down.x;
			const dy = touch.clientY - down.y;
			if (down.axis === 'unknown' && Math.hypot(dx, dy) > 8) down.axis = Math.abs(dx) > Math.abs(dy) ? 'across' : 'along';
			if (down.axis !== 'across') return;
			if (event.cancelable) event.preventDefault();
			const at = performance.now();
			down.speed = (touch.clientX - down.lastX) / Math.max(1, at - down.lastAt);
			down.lastX = touch.clientX;
			down.lastAt = at;
			setMotion('sliding');
			setDragged({kind: 'dragging', amount: still() ? now.current.from : Math.min(1, Math.max(0, now.current.from + dx / width()))});
		};
		const end = (event: TouchEvent) => {
			const down = finger.current;
			finger.current = {kind: 'none'};
			if (down.kind !== 'down' || down.axis !== 'across') return;
			const {pulled, setOut, thread} = now.current;
			const moved = (event.changedTouches[0]?.clientX ?? down.lastX) - down.x;
			setDragged({kind: 'none'});
			setOut(thread !== undefined && endsOpen({from: pulled, moved, width: width(), speed: down.speed}) ? {kind: 'over', thread} : {kind: 'away'});
		};
		// A touch the phone cancels, such as for an incoming call, puts the list back where it was.
		const cancel = () => {
			finger.current = {kind: 'none'};
			setDragged({kind: 'none'});
		};
		element.addEventListener('touchstart', start, {passive: true});
		element.addEventListener('touchmove', move, {passive: false});
		element.addEventListener('touchend', end);
		element.addEventListener('touchcancel', cancel);
		return () => {
			element.removeEventListener('touchstart', start);
			element.removeEventListener('touchmove', move);
			element.removeEventListener('touchend', end);
			element.removeEventListener('touchcancel', cancel);
		};
	}, [area]);

	return {
		pulled,
		dragging: dragged.kind === 'dragging',
		motion,
		onSlid: () => pulled === 'closed' && dragged.kind === 'none' && setMotion('still'),
		amount: dragged.kind === 'dragging' ? dragged.amount : from,
		list,
		area: setArea,
		putAway: () => setOut({kind: 'away'}),
	};
}

// Whether a touch starts inside something that scrolls sideways, such as a
// long line of code in a Message, which keeps its own sideways swipes.
function scrollsSideways(target: EventTarget | null, area: HTMLElement) {
	for (let at = target instanceof Element ? target : null; at && at !== area; at = at.parentElement) {
		const overflow = getComputedStyle(at).overflowX;
		if ((overflow === 'auto' || overflow === 'scroll') && at.scrollWidth > at.clientWidth) return true;
	}
	return false;
}
