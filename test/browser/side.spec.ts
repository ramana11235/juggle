import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

const main = (page: Page) => page.locator('ol[aria-label="Messages"] > li');
const panel = (page: Page) => page.getByRole('region', {name: 'Side discussion'});
const inPanel = (page: Page) => panel(page).locator('ol[aria-label="Messages in the side discussion"] > li');
const row = (page: Page, title: string) => page.getByRole('list', {name: 'Threads'}).getByRole('button', {name: new RegExp(title)});

async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

async function send(page: Page, text: string) {
	await page.getByRole('textbox', {name: 'Message'}).first().fill(text);
	await page.getByRole('button', {name: 'Send'}).first().click();
	await settled(page);
}

async function sendInPanel(page: Page, text: string) {
	await panel(page).getByRole('textbox', {name: 'Message'}).fill(text);
	await panel(page).getByRole('button', {name: 'Send'}).click();
	await settled(page);
}

test('a side discussion started under a Message reaches the other Person live, counted under that Message', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await expect(panel(user1)).toContainText('Free means uncaused.');
	await sendInPanel(user1, 'What about chance?');
	await settled(user2);
	await expect(main(user2)).toHaveCount(1);
	const pill = main(user2).first().getByRole('button', {name: 'Open side discussion, 1 message'});
	await expect(pill.getByLabel('1 unseen')).toBeVisible();
	await pill.click();
	await settled(user2);
	await expect(inPanel(user2).first()).toContainText('What about chance?');
	await expect(pill.getByLabel('1 unseen')).toHaveCount(0);
	await settled(user1);
	await expect(inPanel(user1).first().getByLabel('Seen')).toBeVisible();
});

test('a Message inside a side discussion cannot start one of its own', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await sendInPanel(user1, 'What about chance?');
	await expect(inPanel(user1).first().getByRole('button', {name: 'Reply'})).toHaveCount(1);
	await expect(inPanel(user1).first().getByRole('button', {name: 'Side discussion', exact: true})).toHaveCount(0);
});

test('a side discussion\'s new Messages count in the Thread\'s badge until they are seen in it', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await sendInPanel(user1, 'What about chance?');
	await settled(user2);
	await user2.goto('/');
	await settled(user2);
	await expect(row(user2, 'Free will').getByLabel('2 unseen')).toBeAttached();
	await row(user2, 'Free will').click();
	await settled(user2);
	await user2.goto('/');
	await settled(user2);
	await expect(row(user2, 'Free will').getByLabel('1 unseen')).toBeAttached();
	await row(user2, 'Free will').click();
	await settled(user2);
	await main(user2).first().getByRole('button', {name: /^Open side discussion/}).click();
	await settled(user2);
	await user2.goto('/');
	await settled(user2);
	await expect(row(user2, 'Free will').getByLabel(/unseen/)).toHaveCount(0);
});

test('a side discussion stays open through a reload and closes with Close', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await sendInPanel(user1, 'What about chance?');
	await user1.reload();
	await settled(user1);
	await expect(inPanel(user1).first()).toContainText('What about chance?');
	await panel(user1).getByRole('button', {name: 'Close'}).click();
	await expect(panel(user1)).toHaveCount(0);
});

test('on a phone, Messages arriving in the main conversation while a side discussion covers it stay unseen until it is closed', async ({as}) => {
	test.skip(test.info().project.name !== 'phone', 'A side discussion covers its Thread only on a phone');
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await row(user2, 'Free will').click();
	await settled(user2);
	await main(user2).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await send(user1, 'And chance?');
	await settled(user2);
	const unseen = async () => ((await (await user2.request.get('/api/threads')).json()) as {unseen: number}[])[0].unseen;
	expect(await unseen()).toBe(1);
	await panel(user2).getByRole('button', {name: 'Close'}).click();
	await settled(user2);
	expect(await unseen()).toBe(0);
});

test('Back after closing a side discussion leaves the Thread instead of opening it again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await panel(user1).getByRole('button', {name: 'Close'}).click();
	await expect(panel(user1)).toHaveCount(0);
	await user1.goBack();
	await expect(user1).toHaveURL(/\/$/);
	await expect(panel(user1)).toHaveCount(0);
});

test('on a phone, Back after leaving a Thread with the Threads button does not open it again', async ({as}) => {
	test.skip(test.info().project.name !== 'phone', 'The Threads button shows only on a phone');
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await user1.getByRole('button', {name: 'Threads'}).click();
	await expect(user1).toHaveURL(/\/$/);
	await user1.goBack();
	await expect(user1).not.toHaveURL(/\/t\//);
});

test('a side discussion opened while another is open takes its place, so Close closes the panel', async ({as}) => {
	test.skip(test.info().project.name === 'phone', 'On a phone a side discussion covers the Thread, so another cannot be opened from it');
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await send(user1, 'Free means uncaused.');
	await send(user1, 'Or unforced.');
	await main(user1).first().getByRole('button', {name: 'Side discussion', exact: true}).click();
	await main(user1).nth(1).getByRole('button', {name: 'Side discussion', exact: true}).click();
	await expect(panel(user1)).toContainText('Or unforced.');
	await panel(user1).getByRole('button', {name: 'Close'}).click();
	await expect(panel(user1)).toHaveCount(0);
});
