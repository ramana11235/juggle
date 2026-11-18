import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

const messages = (page: Page) => page.locator('ol[aria-label="Messages"] > li');
const row = (page: Page, title: string) => page.getByRole('list', {name: 'Threads'}).getByRole('button', {name: new RegExp(title)});

async function startThread(page: Page, title: string): Promise<string> {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function send(page: Page, text: string) {
	await page.getByRole('textbox', {name: 'Message'}).last().fill(text);
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
}

// Selects a passage of a Message's words, as a Person does with a mouse or a finger.
async function select(page: Page, passage: string) {
	await page.evaluate((passage) => {
		const walker = document.createTreeWalker(document.querySelector('ol[aria-label="Messages"]')!, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const at = node.textContent!.indexOf(passage);
			if (at < 0) continue;
			const range = document.createRange();
			range.setStart(node, at);
			range.setEnd(node, at + passage.length);
			getSelection()!.removeAllRanges();
			getSelection()!.addRange(range);
			return;
		}
		throw new Error(`No Message has the words "${passage}"`);
	}, passage);
}

test('a Reply to a whole Message shows it quoted, and tapping the quote goes to the original and highlights it', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	const threadId = await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	// Long Messages after it, so the original is out of sight below the Reply.
	for (let n = 1; n <= 8; n++) {
		const sent = await user1.request.post(`/api/threads/${threadId}/messages`, {data: {id: crypto.randomUUID(), body: `Message ${n}. ${'A long thought about free will. '.repeat(20)}`}});
		expect(sent.ok()).toBe(true);
	}
	await row(user2, 'Free will').click();
	await settled(user2);
	await messages(user2).first().getByRole('button', {name: 'Reply'}).click();
	await send(user2, 'Then nothing is free.');
	await settled(user1);
	const reply = messages(user1).last();
	await expect(reply.getByRole('button', {name: 'Go to the quoted Message'})).toHaveText('Free means uncaused.');
	await expect(reply).toContainText('Then nothing is free.');
	await expect(messages(user1).first()).not.toBeInViewport();
	await reply.getByRole('button', {name: 'Go to the quoted Message'}).click();
	await expect(messages(user1).first()).toBeInViewport();
	await expect(messages(user1).first()).toHaveAttribute('data-highlighted', 'true');
});

test('tapping the same quote again flashes the original again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await messages(user1).first().getByRole('button', {name: 'Reply'}).click();
	await send(user1, 'Then nothing is free.');
	const quote = messages(user1).last().getByRole('button', {name: 'Go to the quoted Message'});
	const flashing = () => messages(user1).first().evaluate((element) => element.getAnimations().some((a) => (a as CSSAnimation).animationName === 'highlighted' && a.playState === 'running'));
	await quote.click();
	expect(await flashing()).toBe(true);
	// The first flash is ended at once, so the second tap is what starts one.
	await messages(user1).first().evaluate((element) => element.getAnimations().forEach((a) => a.finish()));
	expect(await flashing()).toBe(false);
	await quote.click();
	expect(await flashing()).toBe(true);
});

test('a Reply quoting two selected passages with words between them shows both in order, and the original marks them as answered', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused. Then nothing is free.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await select(user2, 'Free means uncaused.');
	await user2.getByRole('button', {name: 'Reply to this'}).click();
	await user2.getByRole('textbox', {name: 'Message'}).last().fill('I disagree.');
	await select(user2, 'Then nothing is free.');
	await user2.getByRole('button', {name: 'Reply to this'}).click();
	await send(user2, 'That follows.');
	await settled(user1);
	const reply = messages(user1).last();
	await expect(reply.getByRole('button', {name: 'Go to the quoted Message'})).toHaveText(['Free means uncaused.', 'Then nothing is free.']);
	await expect(reply).toContainText(/Free means uncaused\.\s*I disagree\.\s*Then nothing is free\.\s*That follows\./);
	await expect(messages(user1).first().locator('mark')).toHaveText(['Free means uncaused.', 'Then nothing is free.']);
});

test('a quote taken out of a Reply before sending is not sent', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await messages(user1).first().getByRole('button', {name: 'Reply'}).click();
	await user1.getByRole('button', {name: 'Remove quote'}).click();
	await send(user1, 'On second thought.');
	await expect(messages(user1).last().getByRole('button', {name: 'Go to the quoted Message'})).toHaveCount(0);
	await user1.reload();
	await settled(user1);
	await expect(messages(user1).last().getByRole('button', {name: 'Go to the quoted Message'})).toHaveCount(0);
	await expect(messages(user1).last()).toContainText('On second thought.');
});

test('a Reply being written keeps its quotes through a reload', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await messages(user1).first().getByRole('button', {name: 'Reply'}).click();
	await user1.getByRole('textbox', {name: 'Message'}).last().fill('Then nothing is free.');
	await user1.reload();
	await settled(user1);
	await expect(user1.getByRole('button', {name: 'Remove quote'})).toHaveCount(1);
	await expect(user1.getByRole('textbox', {name: 'Message'}).last()).toHaveValue('Then nothing is free.');
});
