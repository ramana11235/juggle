// Juggle's repeated looks, so every piece of a kind looks the same and is
// changed in one place. The values follow the design rules in docs/design.md.

// Buttons with words: primary for the one action a form is for, such as
// Send, and quiet for stepping back, such as Cancel.
export const button = {
	primary: 'rounded-full bg-primary px-4 py-1 text-note font-medium text-primary-foreground disabled:opacity-30',
	quiet: 'rounded-full px-4 py-1 text-note hover:bg-accent',
};

// A small heading in capitals, such as THREADS, in the secondary ink.
export const label = 'text-label font-medium tracking-label uppercase opacity-60';

// A button that is only an icon. On a phone it is at least 44px across,
// Apple's recommended size for a finger, however small the icon.
export const iconButton = 'inline-grid place-items-center max-md:min-h-11 max-md:min-w-11';
