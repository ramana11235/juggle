import {describe, expect, it} from 'vitest';
import type {Message, SeenPoint} from '../src/shared/api';
import {firstUnseen, seenByEveryoneElse, unseenCount} from '../src/shared/seen';

const message = (id: string, authorId: string, sentAt: number): Message => ({id, threadId: 't', place: {kind: 'main'}, authorId, body: id, parts: [{kind: 'text', text: id}], sentAt, edited: {kind: 'never'}, deleted: false, preview: {kind: 'shown'}});
const point = (personId: string, sentAt: number | 'nothing'): SeenPoint => ({personId, upTo: sentAt === 'nothing' ? {kind: 'nothing'} : {kind: 'message', sentAt}});

describe('a Message is seen by everyone else', () => {
	it('once every other Person\'s point has reached it', () => {
		const sent = message('m', 'me', 5);
		expect(seenByEveryoneElse(sent, [point('me', 'nothing'), point('a', 5), point('b', 9)])).toBe(true);
	});
	it('not while any other Person\'s point is before it, or has seen nothing', () => {
		const sent = message('m', 'me', 5);
		expect(seenByEveryoneElse(sent, [point('me', 9), point('a', 4)])).toBe(false);
		expect(seenByEveryoneElse(sent, [point('me', 9), point('a', 'nothing')])).toBe(false);
	});
	it('not while no one else is in the Thread', () => {
		expect(seenByEveryoneElse(message('m', 'me', 5), [point('me', 9)])).toBe(false);
	});
});

describe('a Thread opens at', () => {
	const messages = [message('a', 'other', 1), message('b', 'me', 2), message('c', 'other', 3), message('d', 'other', 4)];
	it('the first Message someone else sent after the Person\'s point', () => {
		expect(firstUnseen(messages, 'me', {kind: 'message', sentAt: 1})).toEqual({kind: 'message', id: 'c'});
	});
	it('the first Message when the Person has seen nothing', () => {
		expect(firstUnseen(messages, 'me', {kind: 'nothing'})).toEqual({kind: 'message', id: 'a'});
	});
	it('the newest when everything is seen', () => {
		expect(firstUnseen(messages, 'me', {kind: 'message', sentAt: 4})).toEqual({kind: 'newest'});
	});
});

describe('the unseen count of a place', () => {
	const messages = [message('a', 'other', 1), message('b', 'me', 2), message('c', 'other', 3)];
	it('counts the Messages others sent after the Person\'s point', () => {
		expect(unseenCount(messages, 'me', {kind: 'message', sentAt: 1})).toBe(1);
	});
	it('counts every Message others sent when the Person has seen nothing', () => {
		expect(unseenCount(messages, 'me', {kind: 'nothing'})).toBe(2);
	});
});
