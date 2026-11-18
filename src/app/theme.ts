// Juggle is light, dark, or the same as the device, as picked in settings.
// The choice is kept on this device, so each device can have its own. The
// theme's dark colours hang off a .dark class on the root, so menus drawn
// outside the app's own tree get them too.
export type ThemeChoice = 'light' | 'dark' | 'device';

const key = 'juggle-theme';
const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

// Storage can be unavailable, as in some private windows; then Juggle follows
// the device and a choice lasts until the page is closed.
let chosen: ThemeChoice = (() => {
	try {
		const kept = localStorage.getItem(key);
		return kept === 'light' || kept === 'dark' ? kept : 'device';
	} catch {
		return 'device';
	}
})();

const apply = () => document.documentElement.classList.toggle('dark', chosen === 'device' ? deviceDark.matches : chosen === 'dark');
apply();
deviceDark.addEventListener('change', apply);

export const themeChoice = () => chosen;

export function chooseTheme(choice: ThemeChoice) {
	chosen = choice;
	try {
		if (choice === 'device') localStorage.removeItem(key);
		else localStorage.setItem(key, choice);
	} catch {}
	apply();
}
