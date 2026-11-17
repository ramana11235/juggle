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

// The Messages themselves, not the list items inside one.
const message = (page: Page) => page.locator('ol[aria-label="Messages"] > li').last();

test('a Message written in Markdown shows formatted to the other Person', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, ['# Free', 'Is it **uncaused** or *mine*?', 'A second line', '', '- one', '- two', '', '> quoted', '', '`code`', '', '[Stanford](https://plato.stanford.edu)'].join('\n'));
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	const shown = message(user2);
	await expect(shown.getByRole('heading', {name: 'Free'})).toBeVisible();
	await expect(shown.locator('strong')).toHaveText('uncaused');
	await expect(shown.locator('em')).toHaveText('mine');
	await expect(shown.locator('br')).toHaveCount(1);
	await expect(shown.getByRole('listitem')).toHaveText(['one', 'two']);
	await expect(shown.locator('blockquote')).toHaveText('quoted');
	await expect(shown.locator('code')).toHaveText('code');
	const link = shown.getByRole('link', {name: 'Stanford'});
	await expect(link).toHaveAttribute('href', 'https://plato.stanford.edu');
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noreferrer');
});

test('a Message containing HTML or a script link shows it as text and runs nothing', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	const ran: string[] = [];
	await user2.exposeFunction('ran', (what: string) => ran.push(what));
	await startThread(user1, 'Free will');
	await write(user1, ['<img src=x onerror="ran(\'img\')">', '<script>ran("script")</script>', '[click](javascript:ran("link"))'].join('\n\n'));
	await user2.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(user2);
	const shown = message(user2);
	await expect(shown.locator('img, script')).toHaveCount(0);
	await expect(shown).toContainText('<img src=x');
	await expect(shown.getByRole('link', {name: 'click'})).not.toHaveAttribute('href', /javascript/);
	await shown.getByText('click').click();
	await settled(user2);
	expect(ran).toEqual([]);
});

test('the list of Threads shows a Markdown Message as plain text', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await write(user1, '## Free\nIs it **uncaused** or [mine](https://example.com)?');
	await user1.goto('/');
	await settled(user1);
	await expect(user1.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/})).toContainText('user-1: Free Is it uncaused or mine?');
});

test('the text box is back to one line after a long Message is sent', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	const box = user1.getByRole('textbox', {name: 'Message'});
	const oneLine = (await box.boundingBox())!.height;
	await box.fill(Array.from({length: 12}, (_, n) => `Line ${n}`).join('\n'));
	await user1.getByRole('button', {name: 'Send'}).click();
	await settled(user1);
	expect((await box.boundingBox())!.height).toBe(oneLine);
});
