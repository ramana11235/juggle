import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

const openSettings = async (page: Page) => {
	await page.getByRole('button', {name: 'Your name, user-1'}).click();
	return page.getByRole('dialog', {name: 'Settings'});
};
// The page's dark mark, which the device's setting reaches the page a moment after it changes.
const dark = (page: Page) => expect(page.locator('html'));

test('tapping your name opens settings, with your name and the theme each on a row', async ({as}) => {
	const page = await as('user-1@juggle.test');
	const settings = await openSettings(page);
	await expect(settings.getByRole('textbox', {name: 'Your name'})).toHaveValue('user-1');
	await expect(settings.getByRole('group', {name: 'Theme'}).getByRole('button')).toHaveText(['', '', '']);
	await expect(settings.getByRole('button', {name: 'Same as the device'})).toHaveAttribute('aria-pressed', 'true');
	const name = (await settings.getByRole('textbox', {name: 'Your name'}).boundingBox())!;
	const theme = (await settings.getByRole('group', {name: 'Theme'}).boundingBox())!;
	expect([name.width, name.height, name.x + name.width]).toEqual([theme.width, theme.height, theme.x + theme.width]);
});

test('a theme picked in settings changes Juggle at once and stays after a reload', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({colorScheme: 'light'});
	const settings = await openSettings(page);
	await settings.getByRole('button', {name: 'Dark'}).click();
	await dark(page).toHaveClass(/\bdark\b/);
	await settings.getByRole('button', {name: 'Cancel'}).click();
	await page.reload();
	await settled(page);
	await dark(page).toHaveClass(/\bdark\b/);
});

test('Juggle follows the device until a theme is picked, and again once same as the device is picked', async ({as}) => {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({colorScheme: 'dark'});
	await dark(page).toHaveClass(/\bdark\b/);
	const settings = await openSettings(page);
	await settings.getByRole('button', {name: 'Light'}).click();
	await dark(page).not.toHaveClass(/\bdark\b/);
	await settings.getByRole('button', {name: 'Same as the device'}).click();
	await dark(page).toHaveClass(/\bdark\b/);
	await page.emulateMedia({colorScheme: 'light'});
	await dark(page).not.toHaveClass(/\bdark\b/);
});

// The space above a line's letters and below them, inside the box it sits in.
// A box centres the room a line could use, which includes room below for
// descenders, so a line of letters without them sits high unless nudged.
const inkSpace = (page: Page, selector: string) =>
	page.locator(selector).evaluateAll((elements) =>
		elements.map((element) => {
			const style = getComputedStyle(element);
			const box = element.getBoundingClientRect();
			const text = element instanceof HTMLInputElement ? element.value : element.textContent!.trim();
			const context = document.createElement('canvas').getContext('2d')!;
			context.font = style.font;
			const ink = context.measureText(text);
			const top = parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
			const bottom = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
			const line = ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent;
			const baseline = top + (box.height - top - bottom - line) / 2 + ink.fontBoundingBoxAscent;
			return {text, above: baseline - ink.actualBoundingBoxAscent, below: box.height - baseline - ink.actualBoundingBoxDescent};
		}),
	);

test('the words in every box and pill button across Juggle sit in its middle, within a pixel', async ({as}) => {
	const newcomer = await as('user-2@juggle.test', {kind: 'none'});
	await newcomer.evaluate(() => document.fonts.ready);
	await newcomer.getByRole('textbox', {name: "What's your name?"}).fill('user-2');
	const naming = await inkSpace(newcomer, 'input, button:not(:has(svg))');
	const page = await as('user-1@juggle.test');
	await page.evaluate(() => document.fonts.ready);
	await openSettings(page);
	const inSettings = await inkSpace(page, '[role="dialog"] input, [role="dialog"] button:not(:has(svg))');
	await page.getByRole('button', {name: 'Cancel'}).click();
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill('Free will');
	const starting = await inkSpace(page, 'input');
	await page.keyboard.press('Enter');
	await settled(page);
	await page.getByRole('textbox', {name: 'Message'}).fill('What do we mean by free?');
	const inThread = await inkSpace(page, 'button.rounded-full:not(:has(svg))');
	const spaces = [...naming, ...inSettings, ...starting, ...inThread];
	// How far the words sit from the middle is half the difference between the space above and below them.
	for (const space of spaces) expect(Math.abs(space.above - space.below) / 2, `${space.text}: ${space.above} above, ${space.below} below`).toBeLessThanOrEqual(1);
});
