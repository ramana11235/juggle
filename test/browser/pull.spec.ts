import type {Page} from '@playwright/test';
import {expect, settled, test} from './juggle';

test.skip(() => test.info().project.name !== 'phone', 'Pulling the list out over a Thread is for a phone');

async function startThread(page: Page, title: string) {
	await page.getByRole('button', {name: 'New Thread'}).click();
	await page.getByRole('textbox', {name: 'Title'}).fill(title);
	await page.keyboard.press('Enter');
	await settled(page);
}

// A Person on a phone with two Threads, looking at the second. The page's
// clock is faked, so a test sets how fast a finger moves.
async function inThread(as: (email: string) => Promise<Page>) {
	const page = await as('user-1@juggle.test');
	await page.emulateMedia({reducedMotion: 'no-preference'});
	await page.clock.install();
	await page.reload();
	await settled(page);
	await startThread(page, 'Free will');
	await page.getByRole('button', {name: 'Threads'}).click();
	await startThread(page, 'Moral luck');
	return page;
}

const list = (page: Page) => page.locator('aside');
const rightEdge = async (page: Page) => {
	const box = (await list(page).boundingBox())!;
	return box.x + box.width;
};

// A finger on the Thread, from the left third of the screen. Each move takes
// `msPerMove` on the page's clock, so 100px moves at 20ms each is 0.2px/ms.
async function touch(page: Page) {
	const main = page.locator('main');
	const box = (await main.boundingBox())!;
	const start = {x: box.x + 40, y: box.y + box.height / 2};
	let at = {...start};
	const send = (type: string) => main.dispatchEvent(type, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: at.x, clientY: at.y, bubbles: true});
	await page.clock.pauseAt(Date.now() + 60_000);
	await send('pointerdown');
	return {
		async move(dx: number, dy: number, {moves = 5, msPerMove = 20} = {}) {
			for (let n = 0; n < moves; n++) {
				await page.clock.runFor(msPerMove);
				at = {x: at.x + dx / moves, y: at.y + dy / moves};
				await send('pointermove');
			}
		},
		async lift() {
			await send('pointerup');
			await page.clock.resume();
			await list(page).evaluate((element) => element.getAnimations().forEach((a) => a.finish()));
		},
	};
}

test('on a phone, swiping right on a Thread pulls the list of Threads out over it, following the finger', async ({as}) => {
	const page = await inThread(as);
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
	const finger = await touch(page);
	await finger.move(100, 0);
	expect(Math.round(await rightEdge(page))).toBe(100);
	await finger.move(60, 0);
	expect(Math.round(await rightEdge(page))).toBe(160);
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'open');
	expect((await list(page).boundingBox())!.x).toBe(0);
});

test('tapping a Thread in the pulled-out list opens it and puts the list away', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(200, 0);
	await finger.lift();
	await list(page).getByRole('button', {name: /Free will/}).click();
	await settled(page);
	await expect(page.getByRole('heading', {name: 'Free will'})).toBeVisible();
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
});

test('tapping the darkened Thread beside the pulled-out list puts the list away', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(200, 0);
	await finger.lift();
	await page.getByTestId('behind-the-list').click({position: {x: 370, y: 300}});
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
	await expect(page.getByRole('heading', {name: 'Moral luck'})).toBeVisible();
});

test('letting go slowly before a third of the way leaves the Thread as it was', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(100, 0, {moves: 5, msPerMove: 50});
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
});

test('a short flick to the right pulls the list all the way out', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(60, 0, {moves: 3, msPerMove: 10});
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'open');
});

test('a swipe that is mostly up or down leaves the list where it was', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(60, -300);
	expect(Math.round(await rightEdge(page))).toBe(0);
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
});

test('when the device asks for reduced motion, the list does not follow the finger but still comes out', async ({as}) => {
	const page = await inThread(as);
	await page.emulateMedia({reducedMotion: 'reduce'});
	const finger = await touch(page);
	await finger.move(160, 0);
	expect(Math.round(await rightEdge(page))).toBe(0);
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'open');
	expect((await list(page).boundingBox())!.x).toBe(0);
});

test('opening a Thread on a phone does not show the list sliding away', async ({as}) => {
	const page = await inThread(as);
	await expect(list(page)).toBeHidden();
	expect(await list(page).evaluate((element) => [getComputedStyle(element).transitionDuration, element.getAnimations().length])).toEqual(['0s', 0]);
});

test('a Thread started from the pulled-out list opens with the list put away', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(200, 0);
	await finger.lift();
	await startThread(page, 'Why we sleep');
	await expect(page.getByRole('heading', {name: 'Why we sleep'})).toBeVisible();
	await expect(list(page)).toBeHidden();
});

test('a Thread opened after going back from a pulled-out list opens with the list put away', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(200, 0);
	await finger.lift();
	await page.goBack();
	await settled(page);
	await page.getByRole('list', {name: 'Threads'}).getByRole('button', {name: /Free will/}).click();
	await settled(page);
	await expect(list(page)).toBeHidden();
});

test('a Thread on a phone can still be pinched to zoom', async ({as}) => {
	const page = await inThread(as);
	expect(await page.locator('main').evaluate((element) => getComputedStyle(element).touchAction)).toBe('pan-y pinch-zoom');
});
