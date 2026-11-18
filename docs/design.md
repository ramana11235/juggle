# Juggle's design rules

Juggle's look is made from a small set of agreed values, so every screen looks like part of one app and nothing drifts. The theme in `src/app/index.css` holds the values, `src/app/ui.ts` holds the looks used in more than one place, and `scripts/check-design.mjs` fails the build when a screen goes around them, in `npm test` and in CI. A new value is agreed here first, then added to the theme and to `scripts/design-rules.mjs`.

These rules were agreed by comparing the real screens as they were against the proposal (issue #57).

## Text

Six roles, and Tailwind's own sizes are removed from the theme, so no other size is a class.

- `text-label`, 12px: labels in capitals with `tracking-label`, such as THREADS, the names over Messages and the initials.
- `text-note`, 13px: small print, such as times, and the words on buttons.
- `text-compact`, 16px: side discussions, quotes, and the Threads in the list.
- `text-reading`, 17px, and `text-reading-wide`, 18px from laptop width: the words of Messages and the box they are written in, with `leading-reading` and `tracking-reading`.
- `text-name`, 26px: the name Juggle beside its mark.
- `text-title`, 36px, and `text-title-wide`, 48px from laptop width: a Thread's title and the question on the name screen.

## Ink

Three inks, made by fading: full (`opacity-100`), secondary (`opacity-60`) for labels, times and anything that steps back, and faint (`opacity-30`) for what cannot be used yet, such as a disabled button. The words of Messages are a little softer than full ink (`opacity-86`), so long reading is easier on the eyes. Nothing else fades.

## Spacing

One scale: 4, 8, 12, 16, 20, 24, 32, 48 and 64px, which are Tailwind's 1, 2, 3, 4, 5, 6, 8, 12 and 16. Margins, padding, gaps and positions use only these, with two exceptions: the room kept for a phone's safe area, which the phone sets, and `optical-centre`, which every box you type a line into has. A box centres the room a line could use, including room below for descenders, so a serif line without them sits high. The box has a fixed height, and `optical-centre` adds room at the top of a fifth of the font size, which moves the words down by a tenth of it, whatever their size. A browser test measures the words in every box and pill button and fails when they sit more than a pixel off the middle.

A heading sits closer to what it heads than those things are to each other, so it reads as theirs: a Thread's title is 32px above its Messages, which are 48px apart, and the side discussion's label is 12px above what it heads.

## Alignment

On a laptop, a Thread's title starts where its Messages' initials do, which is the left edge the eye takes for the conversation. The words of Messages start 48px further in.

## Corners

Round (`rounded-full`) for pills, buttons and circles, and `rounded-box`, 12px, for boxes, rows and panels.

## Icons

Two sizes: `size-3.5`, 14px, beside small print, and `size-4`, 16px, on buttons.

## Tap targets

On a phone every button that is only an icon is at least 44px across, Apple's recommended size for a finger. Each such button takes `iconButton` from `src/app/ui.ts`, and a browser test fails if one on screen is smaller.

## Buttons

Buttons with words come in two kinds, from `button` in `src/app/ui.ts`: primary for the one action a form is for, such as Send, and quiet for stepping back, such as Cancel.

## The box to write in

Send sits to the right of the words, level with their last line, as in other chat apps.

## Settings

Tapping your name opens settings, one row per setting: its title on the left in plain words, and its control on the right. Every control is the same width and height, so the rows line up.

## Side discussions

A side discussion shows the Message it was started under as a quote, with the left border and italic that quotes use everywhere, so it reads as what is being discussed and not as the first reply.
