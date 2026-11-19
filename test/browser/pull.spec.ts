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

// A finger on the Thread, from the left third of the screen, sent as the
// touch events a phone sends. Each move takes `msPerMove` on the page's
// clock, so 100px moves at 20ms each is 0.2px/ms. `phoneTakesOver` sends the
// pointercancel a phone sends when it decides a touch is a scroll, after
// which it still sends the touch's moves.
async function touch(page: Page) {
	const main = page.locator('main');
	const box = (await main.boundingBox())!;
	let at = {x: box.x + 40, y: box.y + box.height / 2};
	const send = (type: string) => {
		const finger = {identifier: 1, clientX: at.x, clientY: at.y};
		const touches = type === 'touchend' ? [] : [finger];
		return main.dispatchEvent(type, {touches, targetTouches: touches, changedTouches: [finger], bubbles: true, cancelable: true});
	};
	await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
	await send('touchstart');
	return {
		async move(dx: number, dy: number, {moves = 5, msPerMove = 20} = {}) {
			for (let n = 0; n < moves; n++) {
				await page.clock.runFor(msPerMove);
				at = {x: at.x + dx / moves, y: at.y + dy / moves};
				await send('touchmove');
			}
		},
		phoneTakesOver: () => main.dispatchEvent('pointercancel', {pointerType: 'touch', pointerId: 1, isPrimary: true, bubbles: true}),
		async lift() {
			await send('touchend');
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

test('a slow swipe keeps pulling the list out when the phone takes the touch over partway', async ({as}) => {
	const page = await inThread(as);
	const finger = await touch(page);
	await finger.move(60, 0, {moves: 3, msPerMove: 60});
	await finger.phoneTakesOver();
	await finger.move(80, 6, {moves: 4, msPerMove: 60});
	expect(Math.round(await rightEdge(page))).toBe(140);
	await finger.lift();
	await expect(list(page)).toHaveAttribute('data-pulled', 'open');
});

test('once a swipe is going sideways, the phone is stopped from scrolling the Thread', async ({as}) => {
	const page = await inThread(as);
	// Whether each move reaching the page was stopped from scrolling it.
	await page.evaluate(() => {
		(window as unknown as {stopped: boolean[]}).stopped = [];
		document.addEventListener('touchmove', (event) => (window as unknown as {stopped: boolean[]}).stopped.push(event.defaultPrevented));
	});
	const finger = await touch(page);
	// 6px a move: the first is too short to tell which way the swipe goes.
	await finger.move(60, 4, {moves: 10});
	await finger.lift();
	expect(await page.evaluate(() => (window as unknown as {stopped: boolean[]}).stopped)).toEqual([false, ...Array(9).fill(true)]);
});

test('a sideways swipe on code that is wider than the screen scrolls the code, not the list', async ({as}) => {
	const page = await inThread(as);
	await page.getByRole('textbox', {name: 'Message'}).fill(`\`\`\`\n${'const freeWill = compatibilism(); '.repeat(8)}\n\`\`\``);
	await page.getByRole('button', {name: 'Send'}).click();
	await settled(page);
	const code = page.locator('.md pre');
	// Scrolled part of the way along, so it can scroll either way.
	await code.evaluate((element) => (element.scrollLeft = 100));
	await page.evaluate(() => {
		(window as unknown as {stopped: boolean[]}).stopped = [];
		document.addEventListener('touchmove', (event) => (window as unknown as {stopped: boolean[]}).stopped.push(event.defaultPrevented));
	});
	const box = (await code.boundingBox())!;
	const swipe = async (dx: number) => {
		const send = (type: string, x: number) => {
			const finger = {identifier: 1, clientX: x, clientY: box.y + box.height / 2};
			const touches = type === 'touchend' ? [] : [finger];
			return code.dispatchEvent(type, {touches, targetTouches: touches, changedTouches: [finger], bubbles: true, cancelable: true});
		};
		const from = box.x + box.width / 2;
		await send('touchstart', from);
		for (let n = 1; n <= 5; n++) await send('touchmove', from + (dx / 5) * n);
		await send('touchend', from + dx);
	};
	await swipe(150);
	await swipe(-150);
	expect(await page.evaluate(() => (window as unknown as {stopped: boolean[]}).stopped)).toEqual(Array(10).fill(false));
	expect(Math.round(await rightEdge(page))).toBe(0);
	await expect(list(page)).toHaveAttribute('data-pulled', 'closed');
});
