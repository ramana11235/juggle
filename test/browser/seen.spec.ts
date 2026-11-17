import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

async function startThread(page: Page, title: string): Promise<string> {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
	return page.url().split('/t/')[1];
}

async function write(page: Page, body: string) {
	await page.getByRole('textbox', {name: 'Message'}).fill(body);
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
}

// Many long Messages, sent straight to the Worker, so the Thread is taller than any screen.
async function writeMany(page: Page, threadId: string, count: number) {
	for (let n = 1; n <= count; n++) {
		const sent = await page.request.post(`/api/threads/${threadId}/messages`, {data: {id: crypto.randomUUID(), body: `Message ${n}. ${'A long thought about free will. '.repeat(20)}`}});
		expect(sent.ok()).toBe(true);
	}
}

const messages = (page: Page) => page.getByRole('list', {name: 'Messages'}).getByRole('listitem');
const row = (page: Page, title: string) => page.getByRole('list', {name: 'Threads'}).getByRole('button', {name: new RegExp(title)});

test('a Message turns to two ticks only after it has been on the other Person\'s screen', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, 'What do we mean by free?');
	await settled(user2);
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
	await row(user2, 'Free will').click();
	await settled(user2);
	await expect(messages(user1).getByLabel('Seen')).toBeVisible();
});

test('opening a Thread leaves the Messages below the screen unseen, and it reopens at the first of them', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	const threadId = await startThread(user1, 'Free will');
	await writeMany(user1, threadId, 12);
	await user1.reload();
	await settled(user1);
	await settled(user2);
	await row(user2, 'Free will').click();
	await settled(user2);
	await expect(messages(user2).first()).toBeInViewport();
	await expect(messages(user1).first().getByLabel('Seen')).toBeVisible();
	await expect(messages(user1).last().getByLabel('Sent')).toBeVisible();
	await user2.goto('/');
	await settled(user2);
	await row(user2, 'Free will').click();
	await settled(user2);
	await expect(messages(user2).first()).not.toBeInViewport();
	await expect(messages(user2).last()).not.toBeInViewport();
});

test('the badge counts unseen Messages, updates live, and goes once they are seen', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, 'What do we mean by free?');
	await write(user1, 'Uncaused, perhaps.');
	await settled(user2);
	await expect(row(user2, 'Free will').getByLabel('2 unseen')).toBeVisible();
	await row(user2, 'Free will').click();
	await settled(user2);
	await user2.goto('/');
	await settled(user2);
	await expect(row(user2, 'Free will').getByLabel(/unseen/)).toHaveCount(0);
});

test('an open Thread at its newest Message stays there as Messages arrive, so they are seen', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	const threadId = await startThread(user1, 'Free will');
	await writeMany(user1, threadId, 12);
	await row(user2, 'Free will').click();
	await settled(user2);
	await messages(user2).last().scrollIntoViewIfNeeded();
	await settled(user2);
	await write(user1, 'Arrived while you were reading');
	await expect(messages(user2).last()).toContainText('Arrived while you were reading');
	await settled(user2);
	await expect(messages(user2).last()).toBeInViewport();
	await expect(messages(user1).last().getByLabel('Seen')).toBeVisible();
	await write(user2, 'My answer');
	await expect(messages(user2).last()).toBeInViewport();
});

test('a Person reading further up is not moved when a Message arrives', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	const threadId = await startThread(user1, 'Free will');
	await writeMany(user1, threadId, 12);
	await row(user2, 'Free will').click();
	await settled(user2);
	await write(user1, 'Arrived while you were reading');
	await expect(messages(user2).last()).toContainText('Arrived while you were reading');
	await settled(user2);
	await expect(messages(user2).first()).toBeInViewport();
});

test('a seen point that failed to reach the Worker is reported again when the screen is shown again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, 'What do we mean by free?');
	await user2.route('**/api/threads/*/seen', (route) => route.abort());
	await row(user2, 'Free will').click();
	await settled(user2);
	await user2.unroute('**/api/threads/*/seen');
	await user2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await settled(user2);
	await expect(messages(user1).getByLabel('Seen')).toBeVisible();
});
