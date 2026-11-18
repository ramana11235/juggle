// Juggle's mark: three ink circles on a circular orbit, spaced unevenly, each
// standing off the orbit by a ring of whatever is behind it, given as ground.
// It always sits beside the name, so screen readers skip it.
const circles: [number, number][] = [
	[71.9, 24],
	[61.6, 82],
	[16.5, 44.1],
];

function Mark({size, ground}: {size: number; ground: string}) {
	return (
		<svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
			<circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="4" />
			{circles.map(([x, y]) => (
				<circle key={x} cx={x} cy={y} r="10" fill="currentColor" stroke={ground} strokeWidth="3.5" />
			))}
		</svg>
	);
}

// Juggled, shown while something loads: the mark's three circles run round
// the orbit, as styled by .toss in index.css.
export function Juggled({size, ground}: {size: number; ground: string}) {
	return (
		<svg role="img" aria-label="Loading" width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
			<circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="4" />
			{['', 'second', 'third'].map((n) => (
				<g key={n} className={`toss ${n}`}>
					<circle cx="50" cy="16" r="10" fill="currentColor" stroke={ground} strokeWidth="3.5" />
				</g>
			))}
		</svg>
	);
}

// Juggle's name with its mark beside it, on whatever background is given.
export function Heading({ground}: {ground: string}) {
	return (
		<h1 className="flex items-center gap-2 font-serif text-name leading-none font-medium tracking-tight">
			{/* The name's descenders make its box deeper than its letters, so the mark is raised to sit level with them. */}
			<span className="-translate-y-0.75">
				<Mark size={28} ground={ground} />
			</span>
			Juggle
		</h1>
	);
}
