import {describe, expect, it} from 'vitest';
import {tabIcon, tabTitle} from '../src/app/unseenTab';

const badgeText = (icon: string) => decodeURIComponent(icon).match(/class="badge"[^]*?<text[^>]*>([^<]*)<\/text>/)?.[1];

describe('The tab, with the number of unseen Messages', () => {
	it('is titled Juggle with the number before it, as chat apps do', () => {
		expect([tabTitle(3), tabTitle(120)]).toEqual(['(3) Juggle', '(120) Juggle']);
	});

	it('has the number on its icon, showing 9+ past nine', () => {
		expect([badgeText(tabIcon(3)), badgeText(tabIcon(9)), badgeText(tabIcon(10))]).toEqual(['3', '9', '9+']);
	});

	it('shows nothing when no Messages are unseen', () => {
		expect([tabTitle(0), tabIcon(0)]).toEqual(['Juggle', '/juggle-mark.svg']);
	});
});
