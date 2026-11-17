import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

const messages = (page: Page) => page.locator('ol[aria-label="Messages"] > li');
const row = (page: Page, title: string) => page.getByRole('list', {name: 'Threads'}).getByRole('button', {name: new RegExp(title)});

async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

async function send(page: Page, text: string) {
	await page.getByRole('textbox', {name: 'Message'}).last().fill(text);
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
}

async function choose(page: Page, message: number, action: 'Edit' | 'Delete') {
	await messages(page).nth(message).getByRole('button', {name: 'More actions'}).click();
	await page.getByRole('menuitem', {name: action}).click();
}

test('a Message edited by its author shows its new words and a pencil on the other Person\'s screen', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await choose(user1, 0, 'Edit');
	await messages(user1).first().getByRole('textbox', {name: 'Message'}).fill('Free means unforced.');
	await messages(user1).first().getByRole('button', {name: 'Save'}).click();
	await settled(user1);
	await settled(user2);
	await expect(messages(user2).first()).toContainText('Free means unforced.');
	await expect(messages(user2).first().getByLabel(/^Edited at /)).toBeVisible();
});

test('an edit cancelled keeps the words as they were', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await choose(user1, 0, 'Edit');
	await messages(user1).first().getByRole('textbox', {name: 'Message'}).fill('Something else');
	await messages(user1).first().getByRole('button', {name: 'Cancel'}).click();
	await expect(messages(user1).first()).toContainText('Free means uncaused.');
	await expect(messages(user1).first().getByLabel(/^Edited at /)).toHaveCount(0);
});

test('a Message deleted by its author is gone from the other Person\'s screen, and from the Reply quoting it', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await messages(user2).first().getByRole('button', {name: 'Reply'}).click();
	await send(user2, 'Then nothing is free.');
	await settled(user1);
	await choose(user1, 0, 'Delete');
	await settled(user1);
	await settled(user2);
	for (const page of [user1, user2]) {
		await expect(messages(page).first()).toHaveText(/This message was deleted/);
		await expect(messages(page).first()).not.toContainText('Free means uncaused.');
		await expect(messages(page).last()).not.toContainText('Free means uncaused.');
		await expect(messages(page).last()).toContainText('This message was deleted');
	}
	await user2.reload();
	await settled(user2);
	await expect(messages(user2).last()).not.toContainText('Free means uncaused.');
});

test('another Person\'s Message offers no way to edit or delete it', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await expect(messages(user2).first().getByRole('button', {name: 'Reply'})).toHaveCount(1);
	await expect(messages(user2).first().getByRole('button', {name: 'More actions'})).toHaveCount(0);
});

test('choosing Edit puts the cursor in the Message\'s words', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await choose(user1, 0, 'Edit');
	await expect(messages(user1).first().getByRole('textbox', {name: 'Message'})).toBeFocused();
});
