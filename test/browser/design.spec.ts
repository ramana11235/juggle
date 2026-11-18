import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

async function write(page: Page, body: string) {
	await page.getByRole('textbox', {name: 'Message'}).fill(body);
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test('on a laptop, a Thread\'s title starts where its Messages\' initials do', async ({as}) => {
	test.skip(test.info().project.name === 'phone', 'On a phone the initials sit beside the names');
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	const title = await page.getByRole('heading', {name: 'Free will'}).boundingBox();
	const initial = await box(page, '[data-message-id] [data-initial]');
	expect(title!.x).toBe(initial.x);
});

test('Send sits to the right of the text, level with its last line', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	const text = await page.getByRole('textbox', {name: 'Message'}).boundingBox();
	const send = await page.getByRole('button', {name: 'Send'}).boundingBox();
	expect(send!.x).toBeGreaterThanOrEqual(text!.x + text!.width);
	expect(send!.y + send!.height).toBeLessThanOrEqual(text!.y + text!.height);
	expect(send!.y).toBeGreaterThanOrEqual(text!.y);
});

test('on a phone, every button that is only an icon is at least 44px across', async ({as}) => {
	test.skip(test.info().project.name !== 'phone', 'The size is for a finger');
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	const small = await page.locator('button').evaluateAll((buttons) =>
		buttons
			.filter((b) => b.querySelector(':scope > svg') && !b.textContent?.trim() && b.getBoundingClientRect().width > 0)
			.map((b) => ({name: b.getAttribute('aria-label'), width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height}))
			.filter((b) => b.width < 44 || b.height < 44),
	);
	expect(small).toEqual([]);
});

test('a side discussion shows the Message it was started under as a quote, with no dividing line', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	const panel = page.getByRole('region', {name: 'Side discussion'});
	await expect(panel.getByRole('blockquote')).toHaveText('What do we mean by free?');
	await expect(panel.locator('.border-b')).toHaveCount(0);
});

test('on a laptop with a side discussion open, the Thread\'s title and initials are not cut off', async ({as}) => {
	test.skip(test.info().project.name === 'phone', 'On a phone a side discussion covers the Thread');
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	const thread = await box(page, 'main');
	const title = await page.getByRole('heading', {name: 'Free will'}).boundingBox();
	const initial = await box(page, '[data-message-id] [data-initial]');
	expect(title!.x).toBeGreaterThanOrEqual(thread.x);
	expect(initial.x).toBeGreaterThanOrEqual(thread.x);
});

test('on a phone, a button with an icon and words keeps them on one line', async ({as}) => {
	test.skip(test.info().project.name !== 'phone', 'The back button is only on a phone');
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	const back = page.getByRole('button', {name: 'Threads'});
	const icon = await back.locator('svg').boundingBox();
	const words = await back.evaluate((b) => {
		const range = document.createRange();
		range.selectNodeContents(b.lastChild!);
		return range.getBoundingClientRect().toJSON();
	});
	expect(icon!.y + icon!.height).toBeGreaterThan(words.y);
	expect(icon!.y).toBeLessThan(words.y + words.height);
});
