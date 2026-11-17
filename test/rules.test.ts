import {bodyLimit, messageLength, nameLimit} from '../src/shared/api';
import {describe, expect, it} from 'vitest';
import {checkName, checkScreenError, checkSendMessage, checkStartThread} from '../src/worker/rules';

const id = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';

describe('starting a Thread', () => {
	it('accepts a title and an id made by crypto.randomUUID', () => {
		expect(checkStartThread({id, title: '  Free will  '})).toEqual({kind: 'ok', value: {id, title: 'Free will'}});
	});
	it('refuses an empty title', () => {
		expect(checkStartThread({id, title: '   '}).kind).toBe('refused');
	});
	it('refuses a title over the limit', () => {
		expect(checkStartThread({id, title: 'a'.repeat(201)}).kind).toBe('refused');
	});
	it('refuses an id that is not a UUID', () => {
		expect(checkStartThread({id: 'thread-1', title: 'Free will'}).kind).toBe('refused');
	});
	it('refuses a body that is not an object', () => {
		expect(checkStartThread(null).kind).toBe('refused');
	});
});

describe('errors reported by a screen', () => {
	it('keeps the message and stack short', () => {
		const checked = checkScreenError({message: 'x'.repeat(5000), stack: 'y'.repeat(20000)});
		expect(checked.kind === 'ok' && [checked.value.message.length, checked.value.stack.length]).toEqual([2000, 8000]);
	});
});

describe('sending a Message', () => {
	it('keeps the text as written', () => {
		expect(checkSendMessage({id, body: '  two\n\nparagraphs  '})).toEqual({kind: 'ok', value: {id, parts: [{kind: 'text', text: '  two\n\nparagraphs  '}], place: {kind: 'main'}}});
	});
	it('refuses text over the limit', () => {
		expect(checkSendMessage({id, body: 'a'.repeat(100001)}).kind).toBe('refused');
	});
	it('keeps text of 100,000 characters, as long as a long reply gets', () => {
		expect(checkSendMessage({id, body: 'a'.repeat(100000)}).kind).toBe('ok');
	});
});

describe('a name', () => {
	it('is kept without the spaces around it', () => {
		expect(checkName({name: ' Sam '})).toEqual({kind: 'ok', value: 'Sam'});
	});
	it('is refused when blank', () => {
		expect(checkName({name: '   '}).kind).toBe('refused');
	});
	it('is refused when longer than the limit, and kept at the limit', () => {
		expect(checkName({name: 'a'.repeat(nameLimit + 1)}).kind).toBe('refused');
		expect(checkName({name: 'a'.repeat(nameLimit)}).kind).toBe('ok');
	});
	it('is refused when it is not text', () => {
		expect(checkName({name: 7}).kind).toBe('refused');
	});
});

describe('sending a Message in parts', () => {
	const quoted = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
	it('drops parts of blank text and keeps the rest in order', () => {
		const parts = [{kind: 'passage', messageId: quoted, text: 'Free?'}, {kind: 'text', text: '  '}, {kind: 'text', text: 'Yes.'}];
		expect(checkSendMessage({id, parts})).toEqual({kind: 'ok', value: {id, parts: [parts[0], parts[2]], place: {kind: 'main'}}});
	});
	it('refuses parts with no words and no quotes', () => {
		expect(checkSendMessage({id, parts: [{kind: 'text', text: ' '}]}).kind).toBe('refused');
	});
	it('refuses a quote of a Message whose id is not a UUID', () => {
		expect(checkSendMessage({id, parts: [{kind: 'whole', messageId: 'm1', text: 'Free?'}]}).kind).toBe('refused');
	});
	it('refuses a quote with no words in it', () => {
		expect(checkSendMessage({id, parts: [{kind: 'passage', messageId: quoted, text: ' '}]}).kind).toBe('refused');
	});
	it('refuses a part of an unknown kind', () => {
		expect(checkSendMessage({id, parts: [{kind: 'picture', text: 'x'}]}).kind).toBe('refused');
	});
	it('refuses parts whose words together are over the limit', () => {
		expect(checkSendMessage({id, parts: [{kind: 'text', text: 'a'.repeat(50001)}, {kind: 'text', text: 'a'.repeat(50000)}]}).kind).toBe('refused');
	});
});

describe('the place a Message is sent to', () => {
	const parent = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
	const parts = [{kind: 'text', text: 'Yes.'}];
	const place = (given: unknown) => {
		const checked = checkSendMessage({id, parts, place: given});
		return checked.kind === 'ok' ? checked.value.place : checked.kind;
	};
	it('is the main conversation when a screen made before side discussions leaves it out', () => {
		expect(place(undefined)).toEqual({kind: 'main'});
	});
	it('can be the side discussion under a Message named by its UUID', () => {
		expect(place({kind: 'side', messageId: parent})).toEqual({kind: 'side', messageId: parent});
	});
	it('refuses a side discussion under a Message whose id is not a UUID', () => {
		expect(place({kind: 'side', messageId: 'm1'})).toBe('refused');
	});
	it('refuses a place of an unknown kind', () => {
		expect(place({kind: 'elsewhere'})).toBe('refused');
	});
});

describe('the length of a Message', () => {
	it('counts its words and the words it quotes, as the screen and the Worker both measure it', () => {
		expect(messageLength([{kind: 'whole', messageId: 'm', text: 'Free?'}, {kind: 'text', text: 'Yes.'}])).toBe(9);
	});
	it('is limited to 100,000 characters', () => {
		expect(bodyLimit).toBe(100000);
	});
});
