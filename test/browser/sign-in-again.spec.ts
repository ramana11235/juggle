import type {Page} from '@playwright/test';
import {expect, settled, target, test} from './juggle';


async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

// Ends the Person's sign-in, runs what the test does next, and returns once
// the screen has reloaded to sign in again; then signs them back in. On the
// laptop that removes the local sign-in cookie. On beta it also takes the
// service token off calls to the API, so real Access answers them with its
// redirect to sign in, as it does when a session ends.
async function signInEnds(page: Page, action: () => Promise<void>) {
	const cookies = await page.context().cookies();
	await page.context().clearCookies();
	if (target === 'beta')
		await page.route('**/api/**', (route) => {
			const headers = route.request().headers();
			delete headers['cf-access-client-id'];
			delete headers['cf-access-client-secret'];
			return route.continue({headers});
		});
	const reloaded = page.waitForEvent('load');
	await action();
	await reloaded;
	await settled(page);
	await page.unrouteAll();
	await page.context().addCookies(cookies);
	await page.reload();
	await settled(page);
}

const messages = (page: Page) => page.getByRole('list', {name: 'Messages'}).getByRole('listitem');

test('a Message sent after sign-in ended is kept, and sends once signed in again', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await signInEnds(user1, async () => {
		await user1.getByRole('textbox', {name: 'Message'}).fill('Written as sign-in ended');
		await user1.getByRole('button', {name: 'Send'}).click();
	});
	await expect(user1.getByRole('heading', {name: 'Free will'})).toBeVisible();
	await messages(user1).getByLabel('Not sent, send again').click();
	await settled(user1);
	await expect(messages(user1).getByLabel('Sent')).toBeVisible();
	await user1.reload();
	await settled(user1);
	await expect(messages(user1)).toHaveCount(1);
});

test('what a Person was writing when sign-in ended is still in the text box', async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	await startThread(user1, 'Free will');
	await user1.getByRole('textbox', {name: 'Message'}).fill('Half a thought');
	await signInEnds(user1, async () => {
		await user1.goBack();
		await user1.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	});
	await expect(user1.getByRole('textbox', {name: 'Message'})).toHaveValue('Half a thought');
});
