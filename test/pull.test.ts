import {describe, expect, it} from 'vitest';
import {endsOpen} from '../src/app/pull';

// A phone 390px wide; speeds are in pixels per millisecond.
const width = 390;

describe('Letting go of the list of Threads while pulling it out', () => {
	it('leaves it out once it is past a third of the way, however slowly', () => {
		expect(endsOpen({from: 'closed', moved: 140, width, speed: 0})).toBe(true);
	});

	it('leaves it out after a flick to the right, however short', () => {
		expect(endsOpen({from: 'closed', moved: 30, width, speed: 0.6})).toBe(true);
	});

	it('puts it back when let go slowly before a third of the way', () => {
		expect(endsOpen({from: 'closed', moved: 120, width, speed: 0.1})).toBe(false);
	});

	it('puts it back once it is pushed past a third of the way back, or flicked left', () => {
		expect([
			endsOpen({from: 'open', moved: -140, width, speed: 0}),
			endsOpen({from: 'open', moved: -30, width, speed: -0.6}),
			endsOpen({from: 'open', moved: -120, width, speed: -0.1}),
		]).toEqual([false, false, true]);
	});
});
