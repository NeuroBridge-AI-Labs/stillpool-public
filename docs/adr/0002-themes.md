# ADR 0002: Themes are a token contract, and a look fills it

- **Status:** accepted, 26-09-26 (Phase 5, PR 2; extended in PR 2b). **Enforced by:** `check:contrast`, `check:axe`
  (every theme).
- **Files:** `src/styles/tokens.css` (the contract), `src/styles/settings.css` (reader settings), `src/boot.js`.

## Decision

Every `[data-theme]` block defines the same 14 colours and 2 border widths, and sets `color-scheme` (`dark` in `dark`,
`light` in the other two, so native controls match); components use only these names. `:root`
holds the look-wide tokens `--font-display`, `--radius`, `--radius-large`, `--motion-duration` and `--motion-ease`.
Reader settings (font, size, spacing, line height, motion) live in `settings.css` and are never part of a look.

| Tokens | Role | Checked on | Floor |
|---|---|---|---|
| `ground`, `surface`, `surface-raised` | the page, a card, the header band | | the backgrounds below |
| `text`, `text-muted`, `link`, `accent-2-ink` | words (`accent-2-ink`: a second ink) | `ground`, `surface` and `surface-raised` | 4.5:1; 7:1 in `contrast` |
| `on-accent` | words on a button | `accent` | as words |
| `focus`, `border`, `state-todo`, `state-done`, `state-here` | interface | `ground`, `surface` and `surface-raised` | 3:1 |
| `ground` in `light` | calm light | | never `#FFFFFF` |
| `scroll-cue` | the scroll shadow on the home contents (run 28b); a lighter edge in `dark` | `ground` | 1.5 to 2:1 against `ground`, not enforced |
| `border-width`, `border-width-strong` | per theme, so high contrast can thicken them | | px, 1px or more |

- **Extended in PR 2b** (pr2-review SHOULD-FIX 1, EMMI's decision): Warm neural's raised band, second ink, border
  widths and second radius each got a slot at today's neutral values, so PR L stays a token swap. A look with no
  third surface maps `surface-raised` to its `surface`, as the three prototypes below would.

- **Three themes, all required:** `light`, `dark` and `contrast`. **"Match my device" is not a block:** the boot
  script picks `contrast` when the device asks for more contrast, else `dark` or `light` by its colour scheme.
- **The boot script** (`src/boot.js`) is the first child of `<body>` and copies `nbl:settings` onto `<html>` as
  `data-*` attributes before the first paint. Astro hashes no `is:inline` script, so `astro.config.mjs` hashes the
  same file into the CSP (ADR 0001). Without JavaScript the page keeps `data-theme="light"` and the defaults.
- **A look may touch only** `src/styles/tokens.css`, `src/styles/fonts.css`, `public/fonts/`,
  `public/licences.txt`, `NOTICE` and this ADR. Anything else in its diff means it is not a token swap.

## The prototypes, mapped (Phase 4, `.ops/p4-*.html`); Warm neural is the pick

Measured with `check:contrast` on each mapping, in the prototype's light, dark and high-contrast blocks. **Warm
neural** (`.ops/p4-hybrid.html`) is Emanuel's pick of 26-09-26 and is what `tokens.css` holds (PR L): its values
equal the prototype's, token for token.

| Token | Calm nature | Clear neural | Playful illustrated | **Warm neural (the pick)** |
|---|---|---|---|---|
| `ground`, `surface` | `--bg`, `--surface` | `--color-bg`, `--color-surface` | `--paper`, `--raised` | `--color-bg`, `--color-surface` |
| `surface-raised` | its `surface` | its `surface` | its `surface` | `--color-bg-raised` (the header band) |
| `text`, `text-muted` | `--text`, `--text-muted` | `--color-text`, `--color-text-muted` | `--ink`, `--ink-soft` | `--color-text`, `--color-text-muted` |
| `accent-2-ink` | its `text-muted` | its `text-muted` | its `text-muted` | `--color-secondary-ink` |
| `link`, `accent`, `state-here` | `--primary` (here: `--map-lit`) | `--color-primary` | `--sky` | `--color-primary` |
| `on-accent` | `--on-primary` | `--color-on-primary` | `--on-accent` | `--color-on-primary` |
| `focus` | `--focus` | `--color-focus` (its primary) | `--ink` | `--color-focus` (its primary) |
| `border` | `--border` | `--color-border` | `--ink-soft`, not `--line` | `--color-border` |
| `state-todo`, `state-done` | `--map-todo`, `--map-done` | `--color-border`, `--color-success-ink` | `--ink-soft`, `--leaf` | `--color-border`, `--color-success-ink` |
| Widths; radii | not mapped | not mapped | not mapped | `--border-w`, `--border-w-strong` (2px, 3px in high contrast); `--radius-sm`, `--radius-md` |
| `color-scheme` | its `color-scheme`, per block | the same | the same | the same (light, dark, light) |
| Display font | Quicksand | Public Sans (vendored) | Shantell Sans | Public Sans (vendored) |
| Motion | not mapped | not mapped | not mapped | 150ms, `ease` (its transitions) |
| **Result** | every pair passes | every pair passes | passes; with `--line` as `border` it fails at 1.47:1 light and 1.59:1 dark | every pair passes, all three themes |

Playful's `--line` (a decorative rule) is kept for decoration only; `--ink-soft` is 7.91:1 on its paper. Warm
neural's raw `--color-secondary` and `--color-success` are decorative only in the prototype (2.74:1 and 2.81:1 on
its ground), so they have no slot; its `-ink` variants carry text.

## Consequences

- Emanuel's pick is one PR (PR L) whose file list proves it is a swap, and whose `check:contrast` run proves it
  meets the contract. A pair that fails moves one token within his palette, named for his OK.
- A new component that needs a colour the contract lacks changes this ADR first.

## Addendum, 04-10-26: Pool Band v2

Emanuel approved the Pool Band v2 look (`.ops/design/mockups/pool-band-v2` and `lesson-v1`). It adds look-wide tokens to
`:root` (`--s1` to `--s6`, `--radius-media`, `--radius-frame`, `--shadow-raised`, `--band`, `--ease-out`, `--frame`,
`--gutter`) and these per-theme tokens to every `[data-theme]` block: `--pool-a`, `--pool-mid`, `--pool-b` and
`--pool-muted` (the band's blues and its second ink), `--glow` and `--signal` (the band's two accents), `--plate` and
`--branch` (the badge plate and the map's lines), `--card` (a white card; the ground itself in dark), `--tint`,
`--tint-soft` and `--tint-line` (a tint, and the line that stands in for it where the tint is the ground), and
`--shadow-card`. The 14 contract colours are unchanged.

- **The band is dark in every theme and white words sit on it.** In `dark` its stops are never lighter than the ground,
  and a card, a tint and a filled button in `main` are the ground with a line, never a lighter fill (e2e/layout.spec.ts,
  "in the dark theme nothing in main is lighter than the ground").
- **Translucent whites are borders and hover states only**, never a background in `main`, because the check above reads
  the colour without its alpha.
- The header is always the band, so it always carries the dark lockup; the footer keeps the lockup of the theme.
