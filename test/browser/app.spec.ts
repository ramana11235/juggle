import {expect, settled, test} from './juggle';

test('the app opens with its name', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await expect(page.getByRole('heading', {name: 'Juggle'})).toBeVisible();
});

test('the app follows the device in dark mode', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({colorScheme: 'dark'});
	await expect(page.locator('html')).toHaveClass(/dark/);
});

test('a Thread one Person starts opens for them and is in the other Person\'s list', {tag: '@beta'}, async ({as}) => {
	const user1 = await as('user-1@juggle.test');
	const user2 = await as('user-2@juggle.test');
	await user1.getByRole('button', {name: 'New Thread'}).click();
	await user1.getByRole('textbox', {name: 'Title'}).fill('Free will');
	await user1.keyboard.press('Enter');
	await settled(user1);
	await expect(user1.getByRole('heading', {name: 'Free will'})).toBeVisible();
	await user2.reload();
	await settled(user2);
	await expect(user2.getByRole('list', {name: 'Threads'}).getByText('Free will')).toBeVisible();
});
