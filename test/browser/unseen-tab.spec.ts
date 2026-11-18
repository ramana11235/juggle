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

const icon = (page: Page) => page.locator('link[rel="icon"]');

test('the tab shows how many Messages are unseen, live, and nothing once they are seen', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await expect(user2).toHaveTitle('Juggle');
	await startThread(user1, 'Free will');
	await write(user1, 'What do we mean by free?');
	await write(user1, 'Is a choice free when nothing outside forced it?');
	await settled(user2);
	await expect(user2).toHaveTitle('(2) Juggle');
	await expect(icon(user2)).toHaveAttribute('href', /^data:image\/svg\+xml,.*badge/);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await expect(user2).toHaveTitle('Juggle');
	await expect(icon(user2)).toHaveAttribute('href', '/juggle-mark.svg');
});
