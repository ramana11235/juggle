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

// The name of the animation an element runs, or "none".
const animation = (page: Page, selector: string) => page.locator(selector).first().evaluate((element) => getComputedStyle(element).animationName);

test('on a phone, an opened Thread and side discussion slide in from the right', async ({as}) => {
	test.skip(test.info().project.name !== 'phone', 'On a laptop the Thread and side discussion sit beside the list');
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	expect(await animation(page, 'main')).toBe('slide-in');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	expect(await animation(page, 'section[aria-label="Side discussion"]')).toBe('slide-in');
});

test('on a laptop, an opened Thread does not slide in', async ({as}) => {
	test.skip(test.info().project.name === 'phone', 'On a phone the Thread covers the list');
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	expect(await animation(page, 'main')).toBe('none');
});

test('on a laptop, a side discussion opens like a drawer pulled from the right', async ({as}) => {
	test.skip(test.info().project.name === 'phone', 'On a phone a side discussion slides in over the Thread');
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	expect(await animation(page, 'section[aria-label="Side discussion"]')).toBe('drawer-in');
});

test('a closed side discussion goes back the way it came, then is gone', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	const panel = page.locator('section[aria-label="Side discussion"]');
	await panel.evaluate((element) => element.getAnimations().forEach((a) => a.finish()));
	await panel.getByRole('button', {name: 'Close'}).click();
	expect(await animation(page, 'section[aria-label="Side discussion"]')).toBe(test.info().project.name === 'phone' ? 'slide-out' : 'drawer-out');
	await panel.evaluate((element) => element.getAnimations().forEach((a) => a.finish()));
	await expect(panel).toHaveCount(0);
});

test('a closed side discussion is gone at once when the device asks for reduced motion', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'reduce'});
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	await page.getByRole('button', {name: 'Side discussion'}).click();
	await settled(page);
	await page.getByRole('button', {name: 'Close'}).click();
	await expect(page.locator('section[aria-label="Side discussion"]')).toHaveCount(0);
});

test('a new Message fades in', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	expect(await animation(page, '[data-message-id]')).toBe('fade-in');
});

test('nothing slides or fades when the device asks for reduced motion', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'reduce'});
	await startThread(page, 'Free will');
	await write(page, 'What do we mean by free?');
	expect(await animation(page, 'main')).toBe('none');
	expect(await animation(page, '[data-message-id]')).toBe('none');
});
