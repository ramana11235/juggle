// The number of unseen Messages shown on Juggle's browser tab, so something
// new can be seen from outside Juggle: in the tab's title, as chat apps do,
// and as a badge on the tab's icon, which still shows when a narrow or pinned
// tab hides the title.

export const tabTitle = (unseen: number) => (unseen > 0 ? `(${unseen}) Juggle` : 'Juggle');

// Juggle's mark, public/juggle-mark.svg, and with Messages unseen the same
// mark with the number in a filled circle at its lower right. Its colours
// are the theme's ink and primary colours, following the device's light or
// dark setting, as the browser around the tab does.
export function tabIcon(unseen: number) {
	if (unseen === 0) return '/juggle-mark.svg';
	const shown = unseen > 9 ? '9+' : String(unseen);
	const badge = `<g class="badge"><circle cx="70" cy="70" r="30"/><text x="70" y="70" dy="0.36em" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${shown.length > 1 ? 30 : 40}">${shown}</text></g>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>.ink{fill:#1f1c17;stroke:#1f1c17}.badge circle{fill:#2c4f86}.badge text{fill:#ffffff}@media (prefers-color-scheme: dark){.ink{fill:#ebe4d6;stroke:#ebe4d6}.badge circle{fill:#93b2e6}.badge text{fill:#14161a}}</style><circle class="ink" cx="50" cy="50" r="34" style="fill:none" stroke-width="7"/><circle class="ink" cx="71.9" cy="24" r="13" stroke-width="0"/><circle class="ink" cx="61.6" cy="82" r="13" stroke-width="0"/><circle class="ink" cx="16.5" cy="44.1" r="13" stroke-width="0"/>${badge}</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
