import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

const messages = (page: Page) => page.getByRole('list', {name: 'Messages'}).getByRole('listitem');

test('a Person signing in for the first time gives their name before seeing their Threads', async ({as}) => {
	const newcomer = await as('user-1@juggle.test', {kind: 'none'});
	await expect(newcomer.getByRole('list', {name: 'Threads'})).toHaveCount(0);
	await expect(newcomer.getByRole('button', {name: 'Continue'})).toBeDisabled();
	await newcomer.getByRole('textbox', {name: "What's your name?"}).fill('user-1');
	await newcomer.getByRole('button', {name: 'Continue'}).click();
	await settled(newcomer);
	await expect(newcomer.getByRole('button', {name: 'New Thread'})).toBeVisible();
	await newcomer.reload();
	await settled(newcomer);
	await expect(newcomer.getByRole('button', {name: 'Your name, user-1'})).toBeVisible();
});

test('each Message shows its author\'s name', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await user1.getByRole('button', {name: 'New Thread'}).click();
	await user1.getByRole('textbox', {name: 'Title'}).fill('Free will');
	await user1.keyboard.press('Enter');
	await settled(user1);
	await user1.getByRole('textbox', {name: 'Message'}).fill('What do we mean by free?');
	await user1.getByRole('button', {name: 'Send'}).click();
	await settled(user1);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await expect(messages(user2).first()).toContainText('user-1');
});

test('a name a Person changes shows on another Person\'s screen without a reload', {tag: '@beta'}, async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await user1.getByRole('button', {name: 'New Thread'}).click();
	await user1.getByRole('textbox', {name: 'Title'}).fill('Free will');
	await user1.keyboard.press('Enter');
	await settled(user1);
	await user1.getByRole('textbox', {name: 'Message'}).fill('What do we mean by free?');
	await user1.getByRole('button', {name: 'Send'}).click();
	await settled(user1);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	// On a phone the open Thread covers the list, where the name is.
	await user1.goto('/');
	await settled(user1);
	await user1.getByRole('button', {name: 'Your name, user-1'}).click();
	await user1.getByRole('textbox', {name: 'Your name'}).fill('user-1 renamed');
	await user1.getByRole('button', {name: 'Save'}).click();
	await settled(user1);
	await expect(user1.getByRole('button', {name: 'Your name, user-1 renamed'})).toBeVisible();
	await settled(user2);
	await expect(messages(user2).first()).toContainText('user-1 renamed');
});

test('a name a Person changes shows on their own other screens without a reload', async ({as}) => {
	const laptop = await as('user-1@juggle.test');
	const phone = await as('user-1@juggle.test');
	await laptop.getByRole('button', {name: 'Your name, user-1'}).click();
	await laptop.getByRole('textbox', {name: 'Your name'}).fill('user-1 renamed');
	await laptop.getByRole('button', {name: 'Save'}).click();
	await settled(laptop);
	await settled(phone);
	await expect(phone.getByRole('button', {name: 'Your name, user-1 renamed'})).toBeVisible();
});

test('a name starting with an emoji shows that emoji as its initial', async ({as}) => {
	const user1 = await as('user-1@juggle.test', {kind: 'given', text: '🌊 user-1'});
	await expect(user1.getByRole('button', {name: 'Your name, 🌊 user-1'})).toHaveText(/^🌊/);
});

test('a name that fails to save keeps its form open with a mark, and saves when tried again', async ({as}) => {
	const newcomer = await as('user-1@juggle.test', {kind: 'none'});
	await newcomer.route('**/api/me/name', (route) => route.abort());
	await newcomer.getByRole('textbox', {name: "What's your name?"}).fill('user-1');
	await newcomer.getByRole('button', {name: 'Continue'}).click();
	await settled(newcomer);
	await expect(newcomer.getByLabel('Not saved')).toBeVisible();
	await newcomer.unroute('**/api/me/name');
	await newcomer.getByRole('button', {name: 'Continue'}).click();
	await settled(newcomer);
	await newcomer.route('**/api/me/name', (route) => route.abort());
	await newcomer.getByRole('button', {name: 'Your name, user-1'}).click();
	await newcomer.getByRole('textbox', {name: 'Your name'}).fill('user-1 renamed');
	await newcomer.getByRole('button', {name: 'Save'}).click();
	await settled(newcomer);
	await expect(newcomer.getByRole('dialog', {name: 'Change your name'}).getByLabel('Not saved')).toBeVisible();
	await newcomer.unroute('**/api/me/name');
	await newcomer.getByRole('button', {name: 'Save'}).click();
	await settled(newcomer);
	await expect(newcomer.getByRole('button', {name: 'Your name, user-1 renamed'})).toBeVisible();
});
