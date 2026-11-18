// When the list of Threads is let go while being pulled out over a Thread on
// a phone, it finishes the move after a flick, or once it is past a third of
// the way, and goes back where it started otherwise, as drawers in phone
// apps do.
export type Pulled = 'closed' | 'open';

// A flick is a finger moving faster than this, in pixels per millisecond.
const flick = 0.4;

export function endsOpen({from, moved, width, speed}: {from: Pulled; moved: number; width: number; speed: number}): boolean {
	if (from === 'closed') return speed > flick || moved > width / 3;
	return !(speed < -flick || -moved > width / 3);
}
