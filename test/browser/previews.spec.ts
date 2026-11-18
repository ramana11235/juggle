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

// A page on the local Juggle that publishes a preview with this title, so
// the Worker reads a real page without reaching outside the test.
const pageWith = (page: Page, title: string) => {
	const origin = new URL(page.url()).origin;
	return `${origin}/api/local/page?title=${encodeURIComponent(title)}&site=Notes&image=${encodeURIComponent(`${origin}/juggle-mark.svg`)}`;
};
const card = (page: Page) => page.locator('[data-preview]');

// Holds every answer for a link's preview until the returned function lets
// them through, so a test can look at the card while it loads.
async function holdPreviews(page: Page): Promise<() => void> {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	await page.route(/\/api\/previews\?/, async (route) => {
		await released;
		await route.continue();
	});
	return release;
}

test('a link in a Message shows a card with its page\'s picture, title and site', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, `This is the clearest take on it ${pageWith(page, 'Frankfurt cases')}`);
	await expect(card(page)).toHaveAttribute('data-preview', 'found');
	await expect(card(page)).toContainText('Notes');
	await expect(card(page)).toContainText('Frankfurt cases');
	await expect(card(page).locator('img')).toHaveAttribute('src', /juggle-mark\.svg$/);
});

test('while a link\'s preview loads, its card shows the link\'s site, then the preview fades in', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	const release = await holdPreviews(page);
	await page.getByRole('textbox', {name: 'Message'}).fill(`Read ${pageWith(page, 'Frankfurt cases')}`);
	await page.getByRole('button', {name: 'Send'}).click();
	await expect(card(page)).toHaveAttribute('data-preview', 'loading');
	await expect(card(page)).toContainText('localhost');
	release();
	await settled(page);
	await expect(card(page)).toHaveAttribute('data-preview', 'found');
	expect(await card(page).locator('[data-found]').evaluate((element) => getComputedStyle(element).animationName)).toBe('fade-in');
});

test('a link whose page has no preview shows no card', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await startThread(page, 'Free will');
	await write(page, `My notes ${new URL(page.url()).origin}/api/local/page`);
	await expect(card(page)).toHaveCount(0);
	await expect(page.getByRole('list', {name: 'Messages'}).getByRole('link')).toHaveCount(1);
});

test('a Message\'s author can remove its preview, and it is gone for everyone', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, `Read ${pageWith(user1, 'Frankfurt cases')}`);
	await user2.reload();
	await settled(user2);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await expect(card(user2)).toHaveAttribute('data-preview', 'found');
	await expect(card(user2).getByRole('button', {name: 'Remove preview'})).toHaveCount(0);
	await card(user1).getByRole('button', {name: 'Remove preview'}).click();
	await settled(user1);
	await expect(card(user1)).toHaveCount(0);
	await expect(card(user2)).toHaveCount(0);
});

test('a link whose page has no preview folds its card away, then it is gone', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await startThread(page, 'Free will');
	await write(page, `My notes ${new URL(page.url()).origin}/api/local/page`);
	await expect(card(page)).toHaveAttribute('data-preview', 'folding');
	expect(await card(page).evaluate((element) => getComputedStyle(element).animationName)).toBe('fold-away');
	await card(page).evaluate((element) => element.getAnimations().forEach((a) => a.finish()));
	await expect(card(page)).toHaveCount(0);
});
