import {describe, expect, it} from 'vitest';
import {designProblems} from '../scripts/design-rules.mjs';

const problems = (line: string) => designProblems(line).map((p) => p.what);

describe('design rules', () => {
	it('accepts classes made only of agreed values', () => {
		expect(problems(`<div className="mb-8 flex gap-3 px-5 pt-3 text-label tracking-label uppercase opacity-60 rounded-box">`)).toEqual([]);
	});

	it('refuses a value typed in brackets', () => {
		expect(problems(`<span className="text-[13px]">`)).toEqual(['a value typed in brackets: text-[13px]']);
	});

	it('allows a bracketed space for the phone\'s safe area, which has no fixed size', () => {
		expect(problems(`<div className="pb-[max(16px,env(safe-area-inset-bottom))]">`)).toEqual([]);
	});

	it('refuses spacing off the scale', () => {
		expect(problems(`<div className="py-2.5 md:pt-14 -left-12">`)).toEqual(['spacing off the scale: py-2.5', 'spacing off the scale: md:pt-14']);
	});

	it('refuses a fade other than the agreed inks', () => {
		expect(problems(`<span className="opacity-45 hover:opacity-100 disabled:opacity-30">`)).toEqual(['a fade other than 0, 30, 60, 86 or 100%: opacity-45']);
	});

	it('refuses corners other than round and the box corner', () => {
		expect(problems(`<div className="rounded-lg"><span className="rounded-full">`)).toEqual(['a corner other than rounded-full or rounded-box: rounded-lg']);
	});

	it('refuses an icon at a size other than 14 or 16px', () => {
		expect(problems(`<X className="size-5" /><Check className="size-3.5" />`)).toEqual(['an icon at a size other than 3.5 or 4: X size-5']);
	});

	it('gives the line each problem is on', () => {
		expect(designProblems('<div>\n<span className="text-[13px]">').map((p) => p.line)).toEqual([2]);
	});
});
