// Juggle's design rules, as checks on the classes a screen's code uses. The
// theme in src/app/index.css holds the agreed text sizes and corners, and
// these refuse anything that goes around it. docs/design.md says each rule
// and why; a new value is agreed there before it is allowed here.

// The spacing scale, in Tailwind's units of 4px: 4, 8, 12, 16, 20, 24, 32,
// 48 and 64px, and none.
const scale = new Set(['0', '1', '2', '3', '4', '5', '6', '8', '12', '16']);
const spacing = /^-?(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|top|bottom|left|right|inset|inset-x|inset-y)-([0-9.]+)$/;
// Full ink, secondary ink, faint ink, nothing, and the softer ink of the
// words of Messages.
const fades = new Set(['0', '30', '60', '86', '100']);
const iconSizes = new Set(['3.5', '4']);

// Each class with its variants such as md: or hover: taken off.
const bare = (name) => name.slice(name.lastIndexOf(':') + 1);

export function designProblems(source) {
	const found = [];
	source.split('\n').forEach((text, index) => {
		const line = index + 1;
		const add = (what) => found.push({line, what});
		for (const name of text.match(/[\w:.-]+-\[[^\]\s]+\][\w.-]*/g) ?? [])
			if (!name.includes('env(safe-area')) add(`a value typed in brackets: ${name}`);
		for (const name of text.match(/[-\w:.]+/g) ?? []) {
			const plain = bare(name);
			const space = spacing.exec(plain);
			if (space && !scale.has(space[2])) add(`spacing off the scale: ${name}`);
			const fade = /^opacity-([0-9]+)$/.exec(plain);
			if (fade && !fades.has(fade[1])) add(`a fade other than 0, 30, 60, 86 or 100%: ${name}`);
			if (/^rounded(-[a-z0-9]+)*$/.test(plain) && !/^rounded(-[trblxyse]{1,2})?-(full|box)$/.test(plain)) add(`a corner other than rounded-full or rounded-box: ${name}`);
		}
		for (const [, icon, size] of text.matchAll(/<([A-Z]\w*) className="[^"]*\bsize-([0-9.]+)/g))
			if (!iconSizes.has(size)) add(`an icon at a size other than 3.5 or 4: ${icon} size-${size}`);
	});
	return found;
}
