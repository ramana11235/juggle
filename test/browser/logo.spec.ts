import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

async function startThread(page: Page, title: string): Promise<string> {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
	return new URL(page.url()).pathname;
}

// Holds every answer for a Thread's Messages until the returned function
// lets them through, so a test can look at the page while they load.
async function holdMessages(page: Page): Promise<() => void> {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	await page.route(/\/api\/threads\/[^/]+\/messages$/, async (route) => {
		await released;
		await route.continue();
	});
	return release;
}

const juggled = (page: Page) => page.getByRole('img', {name: 'Loading'});

test('the tab and the home screen show Juggle\'s mark', async ({as}) => {
	const page = await as('user-1@juggle.test');
	const icon = await page.request.get((await page.locator('link[rel="icon"]').getAttribute('href'))!);
	expect(icon.headers()['content-type']).toContain('image/svg+xml');
	const homeScreen = await page.request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))!);
	expect(homeScreen.headers()['content-type']).toContain('image/png');
});

test('the name is shown beside Juggle\'s mark', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await expect(page.getByRole('heading', {name: 'Juggle', exact: true}).locator('svg')).toBeVisible();
});

test('Juggle shows only Juggled until the Thread it opens on has loaded', async ({as}) => {
	const page = await as('user-1@juggle.test');
	const address = await startThread(page, 'Free will');
	await page.getByRole('textbox', {name: 'Message'}).fill('What do we mean by free?');
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
	const release = await holdMessages(page);
	await page.goto(address);
	await expect(juggled(page)).toBeVisible();
	await expect(page.getByRole('heading', {name: 'Free will'})).toHaveCount(0);
	release();
	await settled(page);
	await expect(juggled(page)).toHaveCount(0);
	await expect(page.getByRole('list', {name: 'Messages'}).getByText('What do we mean by free?')).toBeVisible();
});

test('a Thread opened later shows Juggled in its place until its Messages have loaded', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await user2.reload();
	await settled(user2);
	const release = await holdMessages(user2);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await expect(user2.getByRole('heading', {name: 'Free will'})).toBeVisible();
	await expect(juggled(user2)).toBeVisible();
	release();
	await settled(user2);
	await expect(juggled(user2)).toHaveCount(0);
});
