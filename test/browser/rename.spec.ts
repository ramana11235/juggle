import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

async function rename(page: Page, title: string) {
	await page.getByRole('button', {name: 'Thread menu'}).click();
	await page.getByRole('menuitem', {name: 'Rename'}).click();
	await page.getByRole('textbox', {name: 'Thread title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

const heading = (page: Page) => page.getByRole('heading', {level: 2});

test('a Thread renamed from its menu shows the new title for the other Person in the list and in the open Thread', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await rename(user1, 'Is free will real?');
	await expect(heading(user1)).toHaveText('Is free will real?');
	await settled(user2);
	await expect(heading(user2)).toHaveText('Is free will real?');
	await user2.goto('/');
	await settled(user2);
	await expect(user2.getByRole('list', {name: 'Threads'})).toContainText('Is free will real?');
});

test('a rename cancelled with Escape keeps the old title', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await user1.getByRole('button', {name: 'Thread menu'}).click();
	await user1.getByRole('menuitem', {name: 'Rename'}).click();
	await user1.getByRole('textbox', {name: 'Thread title'}).fill('Something else');
	await user1.keyboard.press('Escape');
	await settled(user1);
	await expect(heading(user1)).toHaveText('Free will');
});

test('a rename that fails to save keeps the title being typed with a mark, and saves when tried again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await user1.route('**/api/threads/*/title', (route) => route.abort());
	await rename(user1, 'Is free will real?');
	await expect(user1.getByLabel('Not saved')).toBeVisible();
	await expect(user1.getByRole('textbox', {name: 'Thread title'})).toHaveValue('Is free will real?');
	await user1.unroute('**/api/threads/*/title');
	await user1.getByRole('textbox', {name: 'Thread title'}).press('Enter');
	await settled(user1);
	await expect(heading(user1)).toHaveText('Is free will real?');
	await user1.reload();
	await settled(user1);
	await expect(heading(user1)).toHaveText('Is free will real?');
});
