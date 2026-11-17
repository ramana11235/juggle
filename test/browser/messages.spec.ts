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
}

const messages = (page: Page) => page.getByRole('list', {name: 'Messages'}).getByRole('listitem');

test('a Message one Person sends is read by the other', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, 'What do we mean by free?');
	await settled(user1);
	await user2.reload();
	await settled(user2);
	await user2.getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await expect(messages(user2)).toHaveText(['What do we mean by free?'].map((text) => new RegExp(text.replace('?', '\\?'))));
});

test('a Message shows a clock until it is saved, then one tick', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	// The Worker's answer is held until the clock has been seen, so nothing depends on timing.
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await user1.route('**/api/threads/*/messages', async (route) => {
		if (route.request().method() !== 'POST') return route.continue();
		await held;
		await route.continue();
	});
	await write(user1, 'What do we mean by free?');
	await expect(messages(user1).getByLabel('Sending')).toBeVisible();
	release();
	await settled(user1);
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
});

test('a Message that failed to send is sent again once, with the same id', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await user1.route('**/api/threads/*/messages', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
	await write(user1, 'What do we mean by free?');
	await settled(user1);
	await expect(messages(user1).getByLabel('Not sent, send again')).toBeVisible();
	await user1.unroute('**/api/threads/*/messages');
	await messages(user1).getByLabel('Not sent, send again').click();
	await settled(user1);
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
	await user1.reload();
	await settled(user1);
	await expect(messages(user1)).toHaveCount(1);
});

test('a Message sent from a screen stays above the answer that came after it', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await user1.getByRole('button', {name: 'New Thread'}).click();
	await user1.getByRole('textbox', {name: 'Title'}).fill('Free will');
	await user1.keyboard.press('Enter');
	await settled(user1);
	await user1.getByRole('textbox', {name: 'Message'}).fill('Free means uncaused.');
	await user1.getByRole('button', {name: 'Send'}).click();
	await settled(user1);
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await user2.getByRole('textbox', {name: 'Message'}).fill('Then nothing is free.');
	await user2.getByRole('button', {name: 'Send'}).click();
	await settled(user2);
	await settled(user1);
	await expect(user1.locator('ol[aria-label="Messages"] > li')).toContainText(['Free means uncaused.', 'Then nothing is free.']);
});

test('a Message over 100,000 characters cannot be sent, and one at the limit is', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	const box = user1.getByRole('textbox', {name: 'Message'});
	await box.fill('a'.repeat(100001));
	await expect(user1.getByRole('button', {name: 'Send'})).toBeDisabled();
	await box.press('ControlOrMeta+Enter');
	await expect(messages(user1)).toHaveCount(0);
	await box.press('Backspace');
	await user1.getByRole('button', {name: 'Send'}).click();
	await settled(user1);
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
});

test('a Message heard live while its send is still waiting for an answer shows once, as sent', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	// The send reaches the Worker, which saves it and tells every screen,
	// but its answer is held back until the test lets it through.
	let letThrough = () => {};
	const answered = new Promise<void>((resolve) => (letThrough = resolve));
	await user1.route('**/api/threads/*/messages', async (route) => {
		if (route.request().method() !== 'POST') return route.continue();
		const response = await route.fetch();
		await answered;
		await route.fulfill({response});
	});
	await write(user1, 'What do we mean by free?');
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
	await expect(messages(user1)).toHaveCount(1);
	letThrough();
	await settled(user1);
	await expect(messages(user1)).toHaveCount(1);
});
