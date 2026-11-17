// Juggle follows the device's light or dark setting. The theme's dark colours
// hang off a .dark class on the root, so menus drawn outside the app's own
// tree get them too.
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', dark.matches);
apply();
dark.addEventListener('change', apply);
