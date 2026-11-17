import type {Page, WebSocketRoute} from '@playwright/test';
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

const threadList = (page: Page) => page.getByRole('list', {name: 'Threads'});
const messages = (page: Page) => page.getByRole('list', {name: 'Messages'}).getByRole('listitem');

test('a Thread one Person starts appears in the other Person\'s list without a reload', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await expect(threadList(user2).getByText('Free will')).toBeVisible();
});

test('a Message arrives in the other Person\'s open Thread without a reload', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await threadList(user2).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	await write(user1, 'What do we mean by free?');
	await expect(messages(user2)).toHaveCount(1);
	await expect(messages(user2).first()).toContainText('What do we mean by free?');
});

test('a screen whose connection dropped catches up when it connects again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await threadList(user2).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	// The test holds user-2's connection, so it can drop it, and refuses every
	// new one until it says otherwise, so the Message cannot arrive live and
	// only catching up can bring it.
	let allowed = true;
	const connections: WebSocketRoute[] = [];
	await user2.routeWebSocket('**/api/live', (socket) => {
		if (!allowed) return socket.close();
		connections.push(socket);
		socket.connectToServer();
	});
	await user2.reload();
	await settled(user2);
	allowed = false;
	for (const connection of connections) await connection.close();
	await write(user1, 'Written while you were away');
	await expect(messages(user2)).toHaveCount(0);
	allowed = true;
	await user2.evaluate(() => window.dispatchEvent(new Event('online')));
	await settled(user2);
	await expect(messages(user2).first()).toContainText('Written while you were away');
});
