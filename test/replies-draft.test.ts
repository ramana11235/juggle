import type {Root} from 'hast';
import {describe, expect, it} from 'vitest';
import type {Message} from '../src/shared/api';
import {markPassages} from '../src/app/marks';
import {answeredPassages, draftFrom, draftOf, emptyDraft, toSend, withoutPart, withQuote} from '../src/app/replies';

const quoted = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const passage = (text: string) => ({kind: 'passage', messageId: quoted, text}) as const;
const text = (text: string) => ({kind: 'text', text}) as const;

describe('a Reply being written', () => {
	it('takes a quote in place of an empty box and ends with a box to write in', () => {
		expect(withQuote(emptyDraft, passage('Free?'))).toEqual([passage('Free?'), text('')]);
	});
	it('takes a quote after words already written', () => {
		expect(withQuote([text('So')], passage('Free?'))).toEqual([text('So'), passage('Free?'), text('')]);
	});
	it('joins the words either side of a quote taken out', () => {
		expect(withoutPart([text('So'), passage('Free?'), text('yes')], 1)).toEqual([text('So\nyes')]);
	});
	it('keeps a box to write in when its only quote is taken out', () => {
		expect(withoutPart([passage('Free?'), text('')], 0)).toEqual([text('')]);
	});
	it('sends its quotes and words but not its blank boxes', () => {
		expect(toSend([passage('Free?'), text('  ')])).toEqual([passage('Free?')]);
	});
	it('to edit a Message leaves out quotes of deleted Messages and ends with a box to write in', () => {
		expect(draftOf([text('So'), passage('Free?'), {kind: 'deleted', messageId: quoted}])).toEqual([text('So'), passage('Free?'), text('')]);
	});
	it('kept by an older screen as text comes back as words', () => {
		expect(draftFrom('half written')).toEqual([text('half written')]);
	});
});

describe('passages answered', () => {
	it('are gathered for each Message quoted, but not from quotes of a whole Message', () => {
		const reply = (parts: Message['parts']): Message => ({id: crypto.randomUUID(), threadId: 't', place: {kind: 'main'}, authorId: 'a', body: '', parts, sentAt: 1, edited: {kind: 'never'}, deleted: false});
		const answered = answeredPassages([reply([passage('one'), text('x')]), reply([{kind: 'whole', messageId: quoted, text: 'all'}, passage('two')])]);
		expect(answered.get(quoted)).toEqual(['one', 'two']);
	});
	it('are marked where they are found in the words', () => {
		const tree: Root = {type: 'root', children: [{type: 'element', tagName: 'p', properties: {}, children: [{type: 'text', value: 'Free means uncaused. Then nothing is free.'}]}]};
		markPassages(['Then nothing is free.', 'Free means'])()(tree);
		expect(tree.children[0]).toMatchObject({
			children: [
				{type: 'element', tagName: 'mark', children: [{value: 'Free means'}]},
				{type: 'text', value: ' uncaused. '},
				{type: 'element', tagName: 'mark', children: [{value: 'Then nothing is free.'}]},
			],
		});
	});
});
