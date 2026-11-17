import type {ElementContent, Root, RootContent} from 'hast';
// Wraps each passage in a <mark> where it is found in the words.
// shortcut: a passage is marked only where it lies within one run of text, so
// one that crosses formatting or a line break is not marked; mark across runs
// if that shows up in use.
export function markPassages(passages: string[]) {
	const wanted = passages.filter((p) => p.trim() !== '');
	const split = (value: string): ElementContent[] => {
		let first: {at: number; passage: string} | undefined;
		for (const passage of wanted) {
			const at = value.indexOf(passage);
			if (at >= 0 && (!first || at < first.at)) first = {at, passage};
		}
		if (!first) return value === '' ? [] : [{type: 'text', value}];
		return [
			...(first.at > 0 ? [{type: 'text' as const, value: value.slice(0, first.at)}] : []),
			{type: 'element', tagName: 'mark', properties: {}, children: [{type: 'text', value: first.passage}]},
			...split(value.slice(first.at + first.passage.length)),
		];
	};
	const visit = (node: Root | RootContent) => {
		if (!('children' in node)) return;
		node.children = node.children.flatMap((child): RootContent[] => (child.type === 'text' ? split(child.value) : (visit(child), [child]))) as typeof node.children;
	};
	return () => (tree: Root) => (wanted.length > 0 ? visit(tree) : undefined);
}
