# Stillpool

Stillpool is a free website that teaches how AI works, how to write a good prompt, and how to think about AI ethics.
It is made to be easy to read for neurodivergent people: short pages, plain words, a Simple and a Deep layer for each
lesson. There are no accounts and no cookies, and nothing you type leaves your device.

Live site: https://learn.neurobridgeedu.eu

Made by Emanuel Covasa, founder of NeuroBridgeEDU.

## Run it

You need Node 22 and [bun](https://bun.sh).

```
bun install
bun run build
bun run preview
```

`bun run dev` starts the development server. `bun run test:unit` runs the unit tests and `bun run check:content`
runs the lesson checks.

## How the lessons are checked

Every lesson is fact-checked against its sources before it is marked as checked. The review of each lesson is in
`docs/factcheck/`, and the lesson page shows a notice until a current review exists. The automatic checks are in
`checks/`: lesson structure and wording, colour contrast, readability, page weight, links, privacy (no third-party
requests) and accessibility. Each checker has a selftest that makes sure it fails on bad input and stays silent on good
input.

## Licences

The code, from the start of `LICENSE`:

> Copyright (c) 2026 Emanuel Covasa. All rights reserved.
>
> This is the source code of the Stillpool website (src/, checks/, e2e/, scripts/ and the config files). It is not
> open source. No one may use, copy, modify, merge, publish, distribute, sublicense or sell it, in whole or in part,
> without written permission from Emanuel Covasa.

The lessons, from the start of `LICENSE-CONTENT.md`:

> The lessons in `content/` (the text as shown on the site, the recordings' text and the research packs) are licensed under
> the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International licence (CC BY-NC-SA 4.0).

Fonts, voices and data from other people keep their own licences: see `NOTICE`.

## What this copy is

This is a one-commit copy of release `43246658`. The history of the work is not here, and this repository does not
accept pull requests to merge. To report a mistake in a lesson or a barrier in the site, write to
contact@neurobridgeedu.eu.

## What this copy leaves out

Some working files and sources are not published here.

- Internal working notes, plans, decisions and design records (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.codex/`,
  `graphify-out/`, `docs/forge/`, `docs/plan/`, `docs/curriculum/` except the two files the build reads,
  `docs/briefs/`, `docs/practice-lab/`, `docs/brand.md`).
- The live site's search-engine verification file. It is not needed to build the site. Whoever deploys a copy
  supplies their own.
- In `docs/factcheck/`, each local file path on the reviewers' computers is replaced by `[local path]`, and one
  quoted private remark is replaced by a paraphrase. The reviews are otherwise unchanged.
- Research reports and source packs that quote other people's work at length (`docs/research/`, `docs/packs/`).
  Each lesson still lists its sources.
- `docs/curriculum/lesson-list.md` is a short extract: the table of lessons the contents page is built from.
- The tests that compare a lesson with its source pack, because the packs are not here:
  - `src/attention-and-the-context-window.test.ts`
  - `src/feeds.test.ts`
  - `src/images-and-sound.test.ts`
  - `src/search-on-off.test.ts`
  - `src/still-know-name.test.ts`
  - `src/the-next-word.test.ts`
  - `src/training.test.ts`
  - `src/where-your-question-goes.test.ts`
  - `src/why-they-make-things-up.test.ts`
  - `e2e/energy-and-water.spec.ts`
  - `e2e/the-law.spec.ts`
  - `e2e/whats-at-stake.spec.ts`
  - `e2e/who-made-this.spec.ts`
- `check:register` and `check:reviews` (they read the packs and the git history). They are removed from `verify`.
- `scripts/record.ts` reads a source pack to cut one recording, so that one recording cannot be re-made from this copy.
- The `checks/selftest.test.ts` list of places that hold the logo owner sentence does not name `docs/brand.md`.
- Three tests in `scripts/record.test.ts` (the R-1.8 ones) are marked `test.skip`: they read a source pack.
