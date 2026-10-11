// check:selftest. Every checker FAILS on fixtures/bad with each listed reason and nothing else, is SILENT
// on fixtures/good, and treats an empty target as a failure. A check that cannot fail is not a check.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { final } from '../src/factcheck.ts';
import { serve } from './serve.ts';

const run = (name: string, targets: string[]) =>
  spawnSync(process.execPath, [`checks/${name}.ts`, ...targets], { encoding: 'utf8', timeout: 180_000 });

// A reason is an exact stderr line, or [file or page, reason] that must share one line. Browser checkers also print
// a summary to stdout, which the good run must match; static checkers print nothing there.
type Reason = string | [string, string];
type Case = { targets: (kind: string) => string[]; reasons: Reason[]; stdout?: RegExp };
const SLOW = 200_000; // a browser checker launches Chromium; each run's own limit is 180 s, above
const fixture = (name: string) => (kind: string) => [`fixtures/${kind}/${name}`];
const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'selftest-'));
  temps.push(dir);
  return dir;
};
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
// check:reviews reads git history, so its fixtures are two trees made into a repo: base on origin/main, head committed on
// top, one commit per head. `null` is a repo with no origin/main, which must fail closed.
const gitIn = (dir: string) => (...a: string[]) => spawnSync('git', ['-C', dir, '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a]);
const repo = (base: string | null, ...heads: string[]) => {
  const dir = temp();
  const git = gitIn(dir);
  const commit = (tree: string) => {
    for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true });
    cpSync(tree, dir, { recursive: true });
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', tree);
  };
  git('init', '-q');
  commit(base ?? heads[0]);
  if (base) {
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    heads.forEach(commit);
  }
  return dir;
};

const PRODUCT_NAMES = ['NBEDU', 'NeuroBridge', 'NeuroBridgeEDU', 'NeuroBridge AI Labs', 'TaskSage', 'MathSage', 'ElectroSage', 'Learning is Fun'];
const GAME_WORDS = ['streaks', 'leaderboards', 'timers', 'points', 'XP', 'levels', 'percentages', 'x of y counts', 'lives', 'lost on a break', 'notifications', 'locked content', 'social comparison', 'daily goals', 'confetti'];
const INTERFACE_BANS = [
  ['ui/Popups.astro', 'pop-ups'],
  ['ui/Sound.astro', 'sound by default'],
  ['ui/BadgeCount.astro', 'badge counts'],
  ['ui/Styles.astro', 'learning styles or speed reading'],
  ['ui/FontClaim.astro', 'font claim'],
];
const TYPE_RULES = ['italic', 'justify', 'uppercase'];

// Lessons 4.6 and 5.4 may teach one PromptSage layer under Pillar 2's rules: the good fixture is silent, and the same two
// faults as in Pillar 2 still fail there.
test.each([
  ['in the Simple layer', 'A model reads your words in small parts.', 'A model reads your words in small parts. PromptSage can help.', 'PromptSage outside a Deep section'],
  ['in a Deep section with no disclosure', 'Disclosure: PromptSage was created by Emanuel Covasa, who also created this site.', '', 'PromptSage without its disclosure line'],
])('content: PromptSage %s of an allowed lesson fails', (_where, before, after, reason) => {
  const dir = temp();
  cpSync('fixtures/good/content', dir, { recursive: true });
  const file = join(dir, 'lessons/using-ai-well/when-text-tricks-the-ai/index.mdx');
  const text = readFileSync(file, 'utf8');
  expect(text).toContain(before);
  writeFileSync(file, text.replace(before, after));
  const result = run('content', [join(dir, 'lessons'), join(dir, 'src'), '--preview']);
  expect(result.stderr).toBe(`content: using-ai-well/when-text-tricks-the-ai/index.mdx: ${reason}\n`);
  expect(result.status).toBe(1);
});

// A4 N5: these fields reach Simple readers, even when the body keeps PromptSage in a disclosed Deep section.
test.each([
  // R2-N3 / FM-1: these fields also stay visible in Simple.
  ['lesson title', 'title: A plain lesson', 'title: PromptSage guide'],
  ['promise', "promise: Can tell a model's guess from a fact", 'promise: Can use PromptSage for a task'],
  ['badge celebration', 'celebration: You told a guess from a fact.', 'celebration: You used PromptSage for a task.'],
  ['In short', '  - A model reads words in small parts.', '  - Prompt**Sage** has named parts.'],
  ['check-in question', 'question: What does a model do with your words?', 'question: What is PromptSage?'],
  ['check-in option', 'text: It reads them in small parts.', 'text: PromptSage has named parts.'],
  ['check-in feedback', 'why: Yes. It splits the text into small parts first.', 'why: Prompt Sage has named parts.'],
  ['glossary term', 'glossary: []', 'glossary:\n  - term: PromptSage\n    meaning: A prompt framework.'],
  ['glossary meaning', 'glossary: []', 'glossary:\n  - term: framework\n    meaning: PromptSage has named parts.'],
  ['Where next title', 'title: A page to read next', 'title: PromptSage guide'],
  ['Where next text', 'text: A short web page, about five minutes, no login needed.', 'text: PromptSage has named parts.'],
])('content: rejects PromptSage in Simple-visible %s', (_field, before, after) => {
  const dir = temp();
  cpSync('fixtures/good/content', dir, { recursive: true });
  const file = join(dir, 'lessons/prompting/promptsage-ok/index.mdx');
  const text = readFileSync(file, 'utf8');
  expect(text).toContain(before);
  writeFileSync(file, text.replace(before, after));
  const result = run('content', [join(dir, 'lessons'), join(dir, 'src'), '--preview']);
  expect(result.stderr).toBe('content: prompting/promptsage-ok/index.mdx: PromptSage in Simple-visible frontmatter\n');
  expect(result.status).toBe(1);
});

const cases: Record<string, Case> = {
  contrast: {
    targets: (kind) => (kind === 'bad' ? ['fixtures/bad/contrast/themes', 'fixtures/bad/contrast/missing'] : ['fixtures/good/contrast']),
    reasons: [
      'contrast: light: ground is #FFFFFF',
      'contrast: calm: link on ground 4.03:1 < 4.5:1',
      'contrast: calm: link on surface 4.03:1 < 4.5:1',
      'contrast: calm: focus on ground 1.93:1 < 3:1',
      'contrast: calm: focus on surface 1.93:1 < 3:1',
      'contrast: dark: missing --focus',
      'contrast: contrast: text-muted on ground 5.74:1 < 7:1',
      'contrast: contrast: text-muted on surface 5.74:1 < 7:1',
      'contrast: warm: state-here on ground 1.70:1 < 3:1',
      'contrast: warm: state-here on surface 1.70:1 < 3:1',
      'contrast: button: on-accent on accent 2.20:1 < 4.5:1',
      'contrast: missing theme contrast',
      // The extended contract (ADR 0002): a third surface, a second ink, per-theme border widths.
      'contrast: calm: link on surface-raised 4.03:1 < 4.5:1',
      'contrast: calm: focus on surface-raised 1.93:1 < 3:1',
      'contrast: dark: missing --border-width-strong',
      'contrast: calm: --border-width-strong is not 1px or more', // not px
      'contrast: warm: --border-width is not 1px or more', // 0px
      'contrast: contrast: text-muted on surface-raised 5.74:1 < 7:1',
      'contrast: warm: state-here on surface-raised 1.70:1 < 3:1',
      ...['ground', 'surface', 'surface-raised'].map((bg) => `contrast: button: accent-2-ink on ${bg} 2.20:1 < 4.5:1`),
    ],
  },
  readability: {
    targets: fixture('readability'),
    reasons: [
      'readability: checkin.mdx: Simple sentence of 25 words > 20', // the check-in and glossary are Simple text (p6-14-review S1)
      'readability: glossary.mdx: Simple sentence of 26 words > 20',
      'readability: grade.mdx: Simple layer Flesch-Kincaid grade 27.5 > 7 (a proxy; M2 still reads it)',
      'readability: long.mdx: Simple sentence of 28 words > 20',
      'readability: para.mdx: Simple paragraph of 59 words > 50',
      // p6-14-review-r2 S1: a quote of 20 words or fewer is read in full, with its framing; odd quote marks exempt nothing.
      'readability: quote-framing.mdx: Simple sentence of 23 words > 20',
      'readability: quote-r1.mdx: Simple sentence of 25 words > 20',
      'readability: quote-stray.mdx: Simple sentence of 24 words > 20',
      // p6-15-review S6: a related study's note is Simple text; one long sentence also lifts the grade.
      'readability: related/recorded.yaml: Simple layer Flesch-Kincaid grade 10.2 > 7 (a proxy; M2 still reads it)',
      'readability: related/recorded.yaml: Simple sentence of 31 words > 20',
      'readability: summary/recorded.yaml: Simple paragraph of 60 words > 50', // p6 D4: a summary is Simple text
      'readability: tldr.mdx: Simple sentence of 21 words > 20', // R2-N3: In short and Where next are Simple text
      'readability: where-next.mdx: Simple sentence of 21 words > 20',
    ],
  },
  content: {
    // Mirrors the real targets, `content src`: lesson rules on the first, the game-mechanics ban on the
    // rest (the site's UI, never lesson prose), stray pages and em-dashes on both. The bad run is `--preview`, as in
    // verify, so its never-reviewed lessons are preview lines; the publish mode has its own tests below.
    targets: (kind) => [`fixtures/${kind}/content/lessons`, `fixtures/${kind}/content/src`, ...(kind === 'bad' ? ['--preview'] : [])],
    reasons: [
      ['p/no-sources/index.mdx', 'sources'],
      ['p/nc-adapted/index.mdx', 'may be adapted'],
      ['p/bad-competency/index.mdx', 'competencies'],
      ['p/no-sections/index.mdx', 'no ## sections'],
      ['p/missing-deep/index.mdx', 'missing <Deep>'],
      ['p/tryit-between/index.mdx', 'something sits between a </Simple> and its <Deep>'],
      ['p/code-between/index.mdx', 'something sits between a </Simple> and its <Deep>'],
      ['p/inline-between/index.mdx', 'something sits between a </Simple> and its <Deep>'],
      ['p/h3-between/index.mdx', 'something sits between a </Simple> and its <Deep>'],
      ['p/hash-between/index.mdx', 'something sits between a </Simple> and its <Deep>'],
      ['p/no-alt/index.mdx', 'image without alt text'],
      ['p/no-alt-ref/index.mdx', 'image without alt text'],
      ['p/unsure/index.mdx', '[UNSURE]'],
      ['p/no-verdict/', 'missing verdicts/factcheck.yaml'],
      ['p/verdict-fail/', 'verdict: fail'],
      ['p/verdict-yml/', 'verdict: fail'],
      ['p/verdict-no-by/', 'by: a provisional or failed verdict names who wrote it'],
      ['p/pass-with-by/', 'a pass names its checker in its review file, not in by:'],
      ['p/italic/index.mdx', 'italic text'],
      ['p/italic-bold/index.mdx', 'italic text'], // ***x*** renders <em><strong>
      ['p/capitals/index.mdx', 'capitals run'],
      ['p/percent-no-words/index.mdx', 'percentage without words in Simple'],
      ['p/learning-styles/index.mdx', 'learning styles or speed reading outside a myth block'],
      // A typo'd approval is not an approval: `aprovedBy` fails its schema and leaves the lesson unapproved.
      ['p/verdict-typo/', 'Unrecognized key'],
      ['p/verdict-typo/', 'approvedBy: Emanuel'],
      ['p/signed-unapproved/', 'approvedBy: Emanuel'],
      ['p/stray.mdx', 'stray'],
      ['pages/extra.md', 'stray'],
      ['p/mdx-export/index.mdx', 'MDX import/export'],
      ['p/mdx-expression/index.mdx', 'MDX expression'],
      ['p/raw-script/index.mdx', 'element <script> not allowed'],
      ['p/raw-link/index.mdx', 'element <link> not allowed'],
      ...PRODUCT_NAMES.map((n): Reason => ['p/product-names/index.mdx', `product name "${n}"`]),
      ['p/promptsage-wrong-pillar/index.mdx', 'PromptSage outside Pillar 2'],
      ['using-ai-well/promptsage-wrong-lesson/index.mdx', 'PromptSage outside Pillar 2'], // the same disclosed Deep text, in a lesson that is not one of the two allowed
      ['prompting/promptsage-in-simple/index.mdx', 'PromptSage outside a Deep section'],
      ['prompting/promptsage-no-disclosure/index.mdx', 'PromptSage without its disclosure line'],
      ['prompting/promptsage-in-glossary/index.mdx', 'PromptSage in Simple-visible frontmatter'], // A4 N5: the glossary sits outside both depths
      ...GAME_WORDS.map((w): Reason => ['ui/Mechanics.astro', `banned game word (${w})`]),
      ['styles/badge.css', 'banned game word (levels)'], // CSS shows text only through content:
      ['ui/LineComment.astro', 'banned game word (streaks)'], // R4 fail-open: a whole // line in markup is text, not a comment
      ...INTERFACE_BANS.map(([file, label]): Reason => [file, `banned in the interface (${label})`]),
      ...TYPE_RULES.flatMap((t): Reason[] => [['styles/type.css', `typography (${t})`], ['ui/TypeClass.astro', `typography (${t})`]]),
      ['ui/Em.astro', 'typography (italic)'],
      ['styles/shorthand.css', 'typography (italic)'], // font: italic ...
      ['ui/ClassList.astro', 'typography (italic)'], // className={"italic"}
      ['ui/ClassList.astro', 'typography (uppercase)'], // class:list={['uppercase']}
      ['ui/ClassMap.astro', 'typography (uppercase)'], // class:list={{ uppercase: shout }}
      // pr1b-review NICE 2: a class in a template string, the important modifier, and elements italic by default.
      ['ui/Backtick.astro', 'typography (uppercase)'],
      ['ui/ImportantItalic.astro', 'typography (italic)'],
      ...['Cite', 'Dfn', 'Var', 'Address'].map((f): Reason => [`ui/${f}.astro`, 'typography (italic)']),
      // pr2b-review NICE 2: Tailwind's important modifier beats the reader's own !important.
      ...['Tracking', 'Leading', 'Font'].map((f): Reason => [`ui/Important${f}.astro`, "typography (important over the reader's settings)"]),
      ['ui/BadgeExpr.astro', 'banned in the interface (badge counts)'], // {badges.length} badges
      ['ui/CountExpr.astro', 'banned game word (x of y counts)'], // {n} of {total}
      ['ui/Caps.astro', 'capitals run'],
      ['p/bad-inputs/index.mdx', 'inputs: 1: a file under src/lib, src/components or data'], // p6-0-review S6
      // p6-0-review S4, and r2 SHOULD-FIX 4: any file under data/ that no lesson's hash covers, however deep.
      ...['data/recorded/R-9.9.json', 'data/recordings/R-1.2.json', 'data/recorded/runs/R-1.2.json'].map((f): Reason => [f, "no lesson's hash covers this file"]),
      ['p/unlisted-lib/index.mdx', 'inputs: src/lib/sort-messages.ts is imported by SortTheMessages.astro but not listed'],
      ['p/dynamic-lib/index.mdx', 'inputs: src/lib/tokenizer.ts is imported by TokenSplitter.astro but not listed'], // p6-3-review N1
      // p6 D4: what people write about a recording is lesson text, a summary is required, and "by rule" is 1.4's alone.
      ['p/recorded-text/recorded.yaml', 'R-9.7: summary: Invalid input'],
      ['p/recorded-text/recorded.yaml', "R-9.5: summary: by rule is for lesson 1.4's R-1.1, 1.6's R-1.6 and 1.8's R-1.8 only"],
      ['p/recorded-text/recorded.yaml', 'R-9.0: marks: 0: reason: falseText needs a reason'],
      // Pillar 2: each mark must point at a variant, maker and run the recording holds, and a falseText must be in the reply.
      ['p/marks-bad/recorded.yaml', 'R-9.2: marks: A (maker A) run 9 does not exist'],
      ['p/marks-bad/recorded.yaml', 'R-9.2: marks: no variant Z for maker A'],
      ['p/marks-bad/recorded.yaml', 'R-9.2: marks: no variant A for maker B'],
      ['p/marks-bad/recorded.yaml', 'R-9.2: marks: falseText is not in the reply of A (maker A) run 1'],
      ['p/marks-bad/recorded.yaml', 'R-9.1: marks: no data/recorded/R-9.1.json'],
      ['p/recorded-text/recorded.yaml', 'banned game word (x of y counts)'],
      ['p/recorded-text/recorded.yaml', 'percentage without words in Simple'],
      ['p/recorded-text/recorded.yaml', 'banned game word (leaderboards)'], // p6-15-review S6: a related study's note
      // T5.2: the anatomy (D4), the competency registry and the map (D9). The map's membership rules read it even when
      // its schema fails, so one bad map.yaml proves all three of its rules.
      // A source may be cited as unpublished, with no address and only cited; every other source has an https address.
      ['p/source-no-url/index.mdx', 'sources: 0: a source needs a url unless it is unpublished'],
      ['p/unpublished-with-url/index.mdx', 'sources: 0: an unpublished source has no url'],
      ['p/unpublished-adapt/index.mdx', 'sources: 0: an unpublished source can only be cited'],
      ['p/unpublished-link/index.mdx', 'sources: 0: an unpublished source can only be cited'],
      ['p/promise-not-can/index.mdx', 'promise: must start with "Can "'],
      ['p/promise-too-long/index.mdx', 'promise: must be 20 words or fewer'], // R5 SHOULD-FIX 1
      ['p/checkin-two-right/index.mdx', 'checkin: 0: at most one right option'], // R5 SHOULD-FIX 2
      ['p/tldr-two/index.mdx', 'tldr: Too small: expected array to have exactly 3 items'],
      ['p/checkin-no-why/index.mdx', 'why: Invalid input: expected string, received undefined'],
      ['p/checkin-score/index.mdx', 'Unrecognized key: "score"'],
      ['p/badge-praise/index.mdx', 'celebration praises the person'],
      ['p/term-no-gloss/index.mdx', 'term "token" needs a glossary entry'],
      ['p/take-no-approval/index.mdx', 'take: approvedBy: Invalid input: expected "Emanuel"'], // a take is approved by Emanuel, in its own words
      ['p/take-short/index.mdx', 'take: a take is 80 to 150 words'],
      ['p/take-79-spaced/index.mdx', 'take: a take is 80 to 150 words'], // 79 words with a space at each end: trimmed before counting
      ['p/off-map/index.mdx', 'not on the map'],
      ['p/no-unesco-block/index.mdx', 'needs a UNESCO competency block'],
      ['p/no-hea/index.mdx', 'needs an HEA id'],
      ['map.yaml', 'p/ghost is on the map but has no lesson'],
      ['map.yaml', 'Unrecognized key: "locked"'],
      ['map.yaml', 'Too big: expected array to have <=5 items'],
      ['map.yaml', 'pillar prompting appears twice'], // pr5-review NICE 1
      ['map.yaml', 'prompting/promptsage-in-simple appears twice'],
      ...['checkin-1', 'checkin-9', 'pick', 'checkin-02'].map((s): Reason => ['p/earned-by-never/index.mdx', `badge: earnedBy: ${s} can never be earned`]), // pr5-review NICE 2
      ['p/em-dash/index.mdx', 'em dash (&mdash;)'],
      ['p/em-dash/index.mdx', 'em dash (&#8212;)'],
      ['p/em-dash/index.mdx', 'em dash (&#x2014;)'],
    ],
  },
  // T5.1 i: every source row in a research pack has a licence and a use, and adapt only on spec 9's list.
  contents: {
    // Silent on the real repo, the signed list and content/, as the build reads them.
    targets: (kind) => (kind === 'bad' ? ['fixtures/bad/contents'] : ['.']),
    reasons: [
      'contents: 2 pillars, the signed list has 5',
      'contents: 4 lessons, the signed list has 41',
      'contents: 1.3 Tokens is out of order, expected 1.2',
      'contents: pillar 2 has no folder slug',
      "contents: content/how-ai-works/renamed/index.mdx: title 'What AI is' is not a signed lesson of how-ai-works",
      "contents: content/ethics/tokens/index.mdx: title 'Tokens' is not a signed lesson of ethics",
    ],
  },
  register: {
    targets: fixture('register'),
    reasons: [
      "register: pack.md: R1: adapt on 'CC BY-SA 4.0'",
      "register: pack.md: R2: adapt on 'W3C Document License (2023)'",
      "register: pack.md: R3: adapt on 'All rights reserved'",
      'register: pack.md: R4: no licence',
      'register: pack.md: R5: no use (cite, link or adapt)',
      'register: pack.md: R6: short row',
      "register: pack.md: R7: adapt on 'CC BY-SA 4.0 (B)'", // a scoped adapt reads its own source's licence
      "register: pack.md: R8: adapt on 'CC BY-SA 4.0'", // p5-pr10-review SHOULD-FIX 1: "adapted" is adapt
      "register: pack.md: R9: adapt on 'CC BY-NC-SA 4.0'", // and a "License" header is a header
      "register: pack.md: R10: adapt on 'CC BY-NC 4.0'", // as is "Licence (SPDX)" (p5-pr10-review-r2 NICE 1)
      'register: empty.md: no source rows',
    ],
  },
  // R3-S1: a review under docs/factcheck is only ever added. Copies are found at 90% similarity or more.
  reviews: {
    targets: (kind) => {
      if (kind === 'good') return [repo('fixtures/good/reviews/base', 'fixtures/good/reviews/head')];
      // p6-0-review S2: mid adds stacked.md, as a base PR not yet merged; head, stacked on it, edits it.
      const bad = repo('fixtures/bad/reviews/base', 'fixtures/bad/reviews/mid', 'fixtures/bad/reviews/head');
      // p6-0-review-r2 SHOULD-FIX 1: then an edit made inside a merge commit, which a plain `git log` shows no diff for.
      const git = gitIn(bad);
      git('checkout', '-q', '-b', 'side');
      git('commit', '-q', '--allow-empty', '-m', 'side');
      git('checkout', '-q', '-');
      git('merge', '-q', '--no-ff', '--no-commit', 'side');
      cpSync('fixtures/bad/reviews/merge', bad, { recursive: true });
      git('commit', '-q', '-am', 'merge');
      cpSync('fixtures/bad/reviews/untracked', bad, { recursive: true }); // p6-0-review S1: a lazy copy, never added
      return [bad, repo(null, 'fixtures/bad/reviews/base')];
    },
    reasons: [
      'reviews: docs/factcheck/p/x/modified.md: modified (M)',
      'reviews: docs/factcheck/p/x/deleted.md: deleted (D)',
      'reviews: docs/factcheck/p/x/moved.md: renamed from docs/factcheck/p/x/renamed.md (R)',
      'reviews: docs/factcheck/p/x/copy.md: copied from docs/factcheck/p/x/original.md (C)',
      'reviews: docs/factcheck/p/x/stacked.md: modified (M)',
      'reviews: docs/factcheck/p/x/retyped.md: type changed (T)', // p6-0-review N1: a review replaced by a link
      'reviews: docs/factcheck/p/x/lazy.md: untracked: commit a review before verify',
      'reviews: docs/factcheck/p/x/merged.md: modified (M)',
      // p6-0-review-r2 SHOULD-FIX 2: a link anywhere under docs, a folder link on a pillar's path above all.
      'reviews: docs/factcheck/q: a link under docs',
      'reviews: docs/factcheck/p/x/retyped.md: a link under docs',
      // p6-2-review S5: two slots swapped; the good head only appends one.
      'reviews: src/progress/slots.ts: slot 0 moved (append only, D8)',
      ['/', 'no origin/main to compare with'],
    ],
  },
  budget: {
    targets: fixture('budget'),
    reasons: [
      'budget: /html/: HTML+CSS 62.2 KB gz > 60 KB',
      'budget: /js/: JS 81.3 KB gz > 80 KB',
      'budget: /eager/: tokenizer loaded eagerly (_astro/tokenizer.B1.js)',
      'budget: /missing/: missing _astro/gone.js',
      'budget: fonts 256.0 KB > 250 KB',
    ],
  },
  seo: {
    // bad adds a second target for the home rule: the bad home is valid in every other respect
    targets: (kind) => (kind === 'bad' ? ['seo', 'seo-home', 'seo-ghost-loc', 'seo-left-out', 'seo-no-sitemap-line', 'seo-no-image', 'seo-no-sitemap-file', 'seo-wrong-sitemap-host', 'seo-disallow-all'].map((n) => `fixtures/bad/${n}`) : ['fixtures/good/seo']),
    reasons: [
      'seo: /no-description/: description missing or not 50 to 160 characters',
      'seo: /long-title/: title not 10 to 65 characters',
      'seo: /same-title/: title repeats /dup/',
      'seo: /wrong-canonical/: canonical is https://learn.neurobridgeedu.eu/elsewhere/, expected https://learn.neurobridgeedu.eu/wrong-canonical/',
      'seo: /no-og/: missing og:image',
      'seo: /bad-json/: JSON-LD does not parse',
      'seo: /learn/p/no-lesson/: no LearningResource joined to the course and the organisation',
      'seo: /learn/p/default-image/: og:image is https://learn.neurobridgeedu.eu/share.png, expected a lesson share image',
      'seo: /: missing @id https://emmi.zone/#person',
      'seo: /banned/: banned text in head: MayArt',
      'seo: /done/p/x/: must be noindex',
      'seo: /hidden/: noindex on an indexable page',
      'seo: /done/p/canon/: noindex page has a canonical',
      'seo: sitemap.xml: https://learn.neurobridgeedu.eu/ghost/ has no indexable page',
      'seo: /about/: not in sitemap.xml',
      'seo: robots.txt: no Sitemap line',
      'seo: /: og:image file missing',
      'seo: sitemap.xml: missing',
      'seo: robots.txt: Sitemap line is https://wrong.example/sitemap.xml, expected https://learn.neurobridgeedu.eu/sitemap.xml',
      'seo: robots.txt: Disallow line blocks the whole site',
    ],
  },
  links: {
    targets: fixture('links'),
    reasons: [
      'links: /plain/: https://example.com/a: no target="_blank"',
      'links: /noopener/: https://example.com/b: no rel="noopener"',
      'links: /silent/: https://example.com/c: accessible name must contain "(opens in a new tab)" exactly once',
      'links: /internal/: /about/: a link within the site opens a new tab',
      'links: /rel-token/: https://example.com/: no rel="noopener"',
      ...['hidden-warning', 'label-override', 'duplicate-warning', 'exposed-icon'].map((name) => `links: /${name}/: https://example.com/: accessible name must contain "(opens in a new tab)" exactly once`),
      'links: /exposed-icon/: https://example.com/: icon is not aria-hidden="true"',
      'links: /no-icon/: https://example.com/: no visible new-tab icon: the warning span needs class="new-tab"',
      'links: /unquoted/: https://example.com/: no target="_blank"',
      'links: /own-origin/: https://learn.neurobridgeedu.eu/about/: a link within the site opens a new tab',
    ],
  },
  privacy: {
    targets: fixture('privacy'),
    reasons: ['privacy: third-party request: https://example.com/pixel.png', 'privacy: cookie: tracker'],
    stdout: /^third-party requests: 0 {2}cookies: 0\n$/,
  },
  axe: {
    targets: fixture('axe'),
    // /target/ fails only target-size, a WCAG 2.2 rule that axe ships disabled. axe runs every theme of the real
    // src/styles/tokens.css, which the contract fixes at three (docs/adr/0002-themes.md).
    reasons: ['light', 'dark', 'contrast'].flatMap((t) => [`axe: / [${t}]: image-alt`, `axe: /target/ [${t}]: target-size`]),
    stdout: /^violations: 0\n$/,
  },
  lhci: {
    targets: fixture('lhci'),
    reasons: [
      ['lhci: /: accessibility 0.', ' < 1'],
      ['lhci: /: performance 0.', ' < 0.9'],
      ['lhci: /: total-blocking-time ', ' ms > 200 ms'],
      'lhci: /: seo audit meta-description failed',
      'lhci: /: seo audit image-alt failed',
    ],
    stdout: /^lhci: \/: accessibility 1, performance (?:1|0\.9\d*), best-practices (?:1|0\.9\d*), seo 1, CLS [\d.]+, TBT \d+ ms(?: \(median of 3\))?\n$/,
  },
  voice: {
    // bad adds one fixture per rule of the other direction: a part with text and no file, the old split placement (Simple, the activity's own h2, then Deep), ordinary Deep prose after an activity's [data-part] wrapper, and a part that reaches the device voice
    targets: (kind) => ['voice', ...(kind === 'bad' ? ['voice-missing', 'voice-split', 'voice-wrapper', 'voice-device'] : [])].map((n) => `fixtures/${kind}/${n}`),
    reasons: [
      'voice: rogue.js: eSpeak NG or phonemizer code',
      'voice: model_quantized.onnx: generator asset in build',
      'voice: compiled.wasm: generator asset in build',
      'voice: voice/unlisted.mp3: not in voice/manifest.json',
      'voice: voice/phonemizer.wasm: not in voice/manifest.json',
      'voice: voice/intro-simple.mp3: 3 bytes, manifest says 4',
      'voice: voice/intro-simple.mp3: stale, the simple text of / intro changed',
      'voice: voice/intro-deep.mp3: missing',
      'voice: voice/gone-simple.mp3: missing',
      'voice: voice/gone-simple.mp3: stale, the simple text of / gone changed',
      'voice: / a deep: no Emma file',
      'voice: / b simple: no Emma file',
      'voice: / deep "Long version.": outside every read part, no Emma file',
      'voice: / deep "Ordinary prose after a wrapper": outside every read part, no Emma file',
      'voice: / a [Simple]: played [], expected ["/voice/a-simple.mp3"], device voice called 1 times',
      'voice: / a [Deep]: played [], expected ["/voice/a-simple.mp3","/voice/a-deep.mp3"], device voice called 1 times',
    ],
    stdout: /^voice: 1 pages, 1 parts, 2 files, Simple and Deep: all Emma\n$/,
  },
  stillness: {
    // Each reduce fixture is its own site so its page is `/`, the only page the corner arcs may be on.
    targets: (kind) => [
      ...fixture('stillness')(kind),
      ...(kind === 'bad' ? ['fixtures/bad/stillness-reduce', 'fixtures/bad/stillness-reduce-instant', 'fixtures/bad/stillness-reduce-short-drift'] : []),
    ],
    reasons: [
      'stillness: /carousel/ [default]: DOM changed with no input',
      'stillness: /carousel/ [reduce]: DOM changed with no input',
      'stillness: /spinner/ [default]: animation running with no input',
      'stillness: /spinner/ [reduce]: animation running with no input',
      'stillness: /motion-safe/ [default]: animation running with no input',
      // Pixels catch what the DOM and getAnimations() cannot see: /finite/ pulses below the fold and has stopped by
      // the last sample.
      ...['/carousel/ [default]', '/carousel/ [reduce]', '/spinner/ [default]', '/spinner/ [reduce]', '/motion-safe/ [default]',
        '/finite/ [default]', '/finite/ [reduce]'].map((p) => `stillness: ${p}: pixels changed with no input`),
      // pr1b-review SHOULD-FIX 1: a full-page frame is drawn from the top, so a page that scrolls itself needs its own rule.
      'stillness: /docscroll/ [default]: scrolled with no input',
      'stillness: /docscroll/ [reduce]: scrolled with no input',
      // Pool Band v2: one Start orbit is allowed with the device's setting left alone; two are not, and none when set to reduce.
      'stillness: /orbit-two/ [default]: more than one Start orbit',
      'stillness: /orbit-reduce/ [reduce]: animation running with no input',
      'stillness: /orbit-reduce/ [reduce]: pixels changed with no input',
      // Home video corners: allowed with the setting left alone on `/` only, still required to be motionless under reduce.
      // A third arc inside another element still drifts (a finished drift is counted too), more than two arcs fail, and
      // so does any arc off the home page.
      'stillness: / [reduce]: pixels changed with no input',
      'stillness: /corners-third/ [default]: animation running with no input',
      'stillness: /corners-third/ [default]: pixels changed with no input',
      'stillness: /corners-third/ [default]: home corner arcs off the home page',
      'stillness: /corners-third/ [reduce]: home corner arcs off the home page',
      'stillness: /corners-many/ [default]: more than two home corner arcs',
      'stillness: /corners-many/ [default]: home corner arcs off the home page',
      // Under reduce nothing moves, the arcs included: a short drift that ends between frames still counts.
      'stillness: / [reduce]: animation running with no input',
      // Even after an instant animation, a later finite drift on the designated arcs is still forbidden under reduce.
      'stillness: / [reduce]: animation running with no input',
      'stillness: / [reduce]: animation running with no input',
      // GitHub #137, Codex's exact plant: the finite drift (200 ms after 900 ms) ends between two sampled frames, so only the stray counter sees it.
      'stillness: / [reduce]: animation running with no input',
      'stillness: / [reduce]: pixels changed with no input',
      'stillness: /corners-many/ [reduce]: more than two home corner arcs',
      'stillness: /corners-many/ [reduce]: home corner arcs off the home page',
    ],
    stdout: /^DOM changes: 0 {2}running animations: 0\n$/,
  },
};

const hits = (name: string, lines: string[], r: Reason) =>
  typeof r === 'string' ? lines.includes(r) : lines.some((l) => l.startsWith(`${name}: `) && l.includes(r[0]) && l.includes(r[1]));

for (const [name, c] of Object.entries(cases)) {
  test(`${name}: fails on its bad fixture with each reason and nothing else`, () => {
    const r = run(name, c.targets('bad'));
    const lines = r.stderr.trimEnd().split('\n');
    for (const reason of c.reasons) expect(hits(name, lines, reason), `no line for ${JSON.stringify(reason)} in:\n${r.stderr}`).toBe(true);
    expect(lines, 'a rule fired where it should not').toHaveLength(c.reasons.length);
    expect(r.status).toBe(1);
  }, SLOW);

  test(`${name}: silent on its good fixture`, () => {
    const r = run(name, c.targets('good'));
    expect(r.stderr).toBe('');
    expect(r.stdout).toMatch(c.stdout ?? /^$/);
    expect(r.status).toBe(0);
  }, SLOW);

  test(`${name}: an empty target is nothing to check`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'selftest-'));
    try {
      const r = run(name, [dir]);
      expect(r.stderr).toContain(`${name}: nothing to check in ${dir}`);
      expect(r.status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, SLOW);
}

test('stillness: rejects a finite reduce drift after an instant arc animation', () => {
  const r = run('stillness', ['fixtures/bad/stillness-reduce-instant']);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/^DOM changes: 0 {2}running animations: [1-9]\d*\n$/); // the count depends on timing: only that it is not 0
  expect(r.stderr).toBe('stillness: / [reduce]: animation running with no input\n');
}, SLOW);

test('every check script has a selftest case', () => {
  const scripts = Object.keys(pkg.scripts).filter((s) => s.startsWith('check:') && s !== 'check:selftest');
  expect(scripts.map((s) => s.slice('check:'.length)).sort()).toEqual(Object.keys(cases).sort());
});

// Built at runtime: an editor can turn a typed escape into the literal, which would put one in this file.
test('a literal U+2014 written into a lesson is caught', () => {
  const dir = mkdtempSync(join(tmpdir(), 'selftest-'));
  try {
    cpSync('fixtures/good/content', dir, { recursive: true });
    const file = join(dir, 'lessons/p/plain/index.mdx');
    writeFileSync(file, `${readFileSync(file, 'utf8')}\nA pause ${String.fromCharCode(0x2014)} then more.\n`);
    const r = run('content', [join(dir, 'lessons'), join(dir, 'src')]);
    expect(r.stderr).toMatch(/^content: p\/plain\/index\.mdx.*em dash \(U\+2014\)$/m);
    expect(r.status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// T2.6: every package the site ships is credited in public/licences.txt, which the footer links to.
test('every runtime dependency is named in public/licences.txt', () => {
  const lines = readFileSync('public/licences.txt', 'utf8').split('\n');
  for (const name of Object.keys(pkg.dependencies)) expect(lines.some((l) => l.startsWith(`- ${name} `)), name).toBe(true);
});

// D10: check:content is the publish gate and refuses a provisional fact-check; `verify` runs it with --preview
// until launch, which lists each provisional lesson on stdout instead.
test('a provisional fact-check is refused, and passes only with --preview', () => {
  const dir = mkdtempSync(join(tmpdir(), 'selftest-'));
  try {
    cpSync('fixtures/good/content', dir, { recursive: true });
    writeFileSync(join(dir, 'lessons/p/plain/verdicts/factcheck.yaml'), 'verdict: provisional\nby: vanilla\n');
    const targets = [join(dir, 'lessons'), join(dir, 'src')];
    const refused = run('content', targets);
    expect([refused.status, refused.stderr]).toEqual([1, 'content: p/plain/verdicts/factcheck.yaml: verdict: provisional (not publishable)\n']);
    const preview = run('content', [...targets, '--preview']);
    expect([preview.status, preview.stderr, preview.stdout]).toEqual([0, '', 'content: preview only, not publishable: p/plain\n']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// D5 (P6.0): the fact-check gate in publish mode. Each attack from the plan's critiques has a lesson here: the writer's
// own family, a name in no family or in two, a malformed or template review, a CHECKED line unlike its file name, a
// WRITER unlike provenance.model, a hash pasted into an old review, a twin lesson's review copied in, two reviews of
// one SHA naming different hashes, a linked index.mdx, a review that is a link or a folder, a final which-reply lesson not naming R-1.1. p/twin-a is the one lesson here that passes.
test('the fact-check gate refuses every attack', () => {
  const r = run('content', ['fixtures/bad/factcheck/lessons']);
  const lines = r.stderr.trimEnd().split('\n');
  const reasons: [string, string][] = [
    ['p/same-family/', "CHECKER claude-sonnet-5 is the writer's model family (anthropic)"],
    ['p/writer-no-family/', 'WRITER vanilla maps to no model family'],
    ['p/two-families/', 'CHECKER claude-codex maps to 2 model families'],
    ['p/checker-no-family/', 'CHECKER gpt5 maps to no model family'], // whole tokens only
    ['p/no-checker/', 'must end with WRITER, CHECKER, CHECKED, REVIEWED SHA and VERDICT: PASS lines'],
    ['p/template-verdict/', 'must end with WRITER, CHECKER, CHECKED, REVIEWED SHA and VERDICT: PASS lines'],
    ['p/checked-mismatch/', 'CHECKED does not match its file name'],
    ['p/writer-mismatch/', 'WRITER claude-opus-5-5 does not match provenance.model gpt-5.5'],
    ['p/pasted-hash/', 'factcheck is out of date: no review for p/pasted-hash at its current hash'],
    ['p/twin-b/', 'factcheck is out of date: no review for p/twin-b at its current hash'],
    ['p/dup-sha/', 'two reviews of REVIEWED SHA'],
    ['p/linked/index.mdx', 'a link in a lesson folder is outside the hash'], // p6-0-review B1
    ['p/review-link/', 'a review is a regular file'], // S3: its target could change after it was added
    ['p/review-dir/', 'a review is a regular file'], // N2
    ['p/which-reply/', 'a final which-reply lesson names R-1.1 in its recorded.yaml'], // S5
    ['p/which-reply/index.mdx', 'interactive which-reply: no src/components/WhichReply.astro, so its text is outside the hash'], // critic S3
  ];
  for (const [file, reason] of reasons) expect(hits('content', lines, [file, reason]), `no line for ${file} ${reason} in:\n${r.stderr}`).toBe(true);
  expect(lines).toHaveLength(reasons.length);
  expect(r.status).toBe(1);
});

// critic S4: the page, its e2e spec and the gate decide "final" in one function, so a same-family review is not final.
// p6-0-review-r2 SHOULD-FIX 3: every fixture lesson, so a rule outside final() shows up as a lesson both call final.
test('final() agrees with the gate', () => {
  const lines = run('content', ['fixtures/bad/factcheck/lessons']).stderr;
  const ids = readdirSync('fixtures/bad/factcheck/lessons/p');
  expect(ids).toContain('twin-a');
  const isFinal = (id: string) => {
    try {
      return final('fixtures/bad/factcheck/lessons', `p/${id}`);
    } catch {
      return false; // a link in the folder: the page build throws (p6-0-review B1)
    }
  };
  for (const id of ids) expect(isFinal(id), id).toBe(!lines.includes(`p/${id}/`));
});

// D5, two modes: a lesson changed after its review is a preview line in --preview (verify stays green) and a finding in
// publish mode, and the good fixture's reviewed lessons are silent in both.
test('a lesson changed after its review is refused, and passes only with --preview', () => {
  const dir = temp();
  cpSync('fixtures/good/content', dir, { recursive: true });
  const targets = [join(dir, 'lessons'), join(dir, 'src')];
  expect(run('content', [...targets, '--preview']).stdout).toBe('');
  const file = join(dir, 'lessons/p/plain/index.mdx');
  writeFileSync(file, `${readFileSync(file, 'utf8')}\nOne more sentence.\n`);
  const refused = run('content', targets);
  expect([refused.status, refused.stderr]).toEqual([1, 'content: p/plain/verdicts/factcheck.yaml: factcheck is out of date: no review for p/plain at its current hash\n']);
  const preview = run('content', [...targets, '--preview']);
  expect([preview.status, preview.stderr, preview.stdout]).toEqual([0, '', 'content: preview only, not publishable: p/plain (fact-check out of date)\n']);
});

// D5's hash (R3-S3, R3-S4): each file framed by its length, a named recording that is missing marked, the interactive's
// own component and data inside, the shared shell, dotfiles and verdicts outside.
test('--hash frames by length and covers what the learner reads', () => {
  const dir = temp();
  const lesson = join(dir, 'content/p/x');
  mkdirSync(lesson, { recursive: true });
  const put = (f: string, text: string) => {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), text);
  };
  const hash = () => {
    const r = run('content', ['--hash', 'p/x', join(dir, 'content')]);
    expect(r.stderr).toBe('');
    return r.stdout.trim();
  };
  // The collision the round-3 critique proved for <path>\0<bytes>: a path and bytes moved into the previous file.
  put('content/p/x/index.mdx', 'TEXT');
  put('content/p/x/recorded.yaml', 'summary: S');
  const split = hash();
  rmSync(join(lesson, 'recorded.yaml'));
  put('content/p/x/index.mdx', 'TEXTcontent/p/x/recorded.yaml\0summary: S');
  expect(hash()).toMatch(/^[0-9a-f]{64}$/);
  expect(hash()).not.toBe(split);

  put('content/p/x/index.mdx', '---\ninteractive: demo-thing\ninputs: [src/lib/demo.ts, data/training/demo.txt]\n---\nTEXT');
  put('content/p/x/recorded.yaml', 'R-9.9:\n  summary: S\n');
  const seen = new Set([hash()]);
  const changes = (f: string) => {
    put(f, `${Math.random()}`);
    const h = hash();
    const fresh = !seen.has(h);
    seen.add(h);
    return fresh;
  };
  expect(changes('data/recorded/R-9.9.json'), 'a named recording arriving').toBe(true);
  expect(changes('data/recorded/R-9.9.json'), 'a named recording changing').toBe(true);
  expect(changes('data/interactive/demo-thing.json'), "the interactive's data").toBe(true);
  expect(changes('data/interactive/demo-thing-items.json'), "the interactive's other data").toBe(true);
  expect(changes('src/components/DemoThing.astro'), "the interactive's own component").toBe(true);
  expect(changes('src/lib/demo.ts'), 'a listed input (p6-0-review S6)').toBe(true);
  expect(changes('data/training/demo.txt'), 'another listed input').toBe(true);
  // critic S5: --inputs lists what the hash covers, so the checker's brief puts all of it in front of the other family.
  expect(run('content', ['--inputs', 'p/x', join(dir, 'content')]).stdout.split('\n')).toEqual(expect.arrayContaining(['content/p/x/index.mdx', 'data/recorded/R-9.9.json', 'src/components/DemoThing.astro', 'src/lib/demo.ts']));
  const before = hash();
  for (const f of ['src/components/Shell.astro', 'src/lib/other.ts', 'data/recorded/R-9.8.json', 'content/p/x/.DS_Store', 'content/p/x/verdicts/factcheck.yaml']) put(f, 'x');
  expect(hash(), 'the shell, an unlisted lib, an unnamed recording, dotfiles and verdicts are outside').toBe(before);
});

// pr3-review NICE 1: a plain `..` is pre-normalised by new URL() before serve.ts's own guard ever
// sees it, so it 404s even with the guard removed and proves nothing. Only a %2f-encoded traversal
// (decoded, then collapsed by path.join, then caught by the startsWith(root) check) exercises it.
test('serve 404s a percent-encoded .. traversal out of its root', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'selftest-'));
  try {
    writeFileSync(join(parent, 'SECRET.txt'), 'top secret');
    const root = join(parent, 'root');
    mkdirSync(root);
    writeFileSync(join(root, 'index.html'), '<p>hi</p>');
    const { origin, close } = await serve(root);
    try {
      const r = await fetch(`${origin}/..%2fSECRET.txt`);
      expect(r.status).toBe(404);
    } finally {
      await close();
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

// D14: every e2e test runs under e2e/guard.ts, so every interaction path is also a privacy and calm check. Every file
// Playwright would run imports it (pr3-review SHOULD-FIX 1), and no file in e2e/ but the guard names a Playwright
// package in any quote, so a helper cannot re-export an unguarded test (fold-review SHOULD-FIX 1). readdirSync, not
// globSync, so dot-files are read too (pr5-review SHOULD-FIX 1). The limit: this is a text rule. It catches accidents,
// not deliberate evasion: a helper outside e2e/ or a computed specifier ('@playwright' + '/test') still gets past it.
test('every e2e spec imports test from ./guard.ts', () => {
  const files = readdirSync('e2e', { recursive: true, withFileTypes: true }).filter((f) => f.isFile()).map((f) => join(f.parentPath, f.name));
  const specs = files.filter((f) => /\.(?:spec|test)\.(?:[cm]?[jt]s|[jt]sx)$/.test(f));
  expect(specs).toContain(join('e2e', 'guard.spec.ts'));
  for (const spec of specs) expect(readFileSync(spec, 'utf8'), spec).toMatch(/^import \{[^}]*\btest\b[^}]*\} from ['"]\.\.?\/guard\.ts['"]/m);
  for (const file of files)
    if (file !== join('e2e', 'guard.ts'))
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/['"`](?:@playwright\/test|playwright(?:\/test)?|playwright-core)['"`]/);
});

// The owner sentence (Emanuel, 26-09-26, reworded 04-10-26) is a legal statement, so each of its five places holds it
// exactly once, read as text (tags and &nbsp; allowed). LICENSE is the all-rights-reserved notice, not an open licence.
test('the logo owner sentence is in its five places, and LICENSE is all rights reserved', () => {
  const owner = 'The NeuroBridgeEDU name and logo belong to Emanuel Covasa and are not covered by the CC BY-NC-SA 4.0 licence.';
  for (const file of ['NOTICE', 'LICENSE-CONTENT.md', 'public/licences.txt', 'src/components/Footer.astro'])
    expect(readFileSync(file, 'utf8').replace(/<[^>]*>/g, '').replace(/(?:&nbsp;|\s)+/g, ' ').split(owner).length - 1, file).toBe(1);
  const licence = readFileSync('LICENSE', 'utf8');
  expect(licence, 'LICENSE').toMatch(/^Copyright \(c\) 2026 Emanuel Covasa\. All rights reserved\./);
  expect(licence, 'LICENSE').not.toMatch(/Permission is hereby granted|MIT License/);
  expect(JSON.parse(readFileSync('package.json', 'utf8')), 'package.json').toMatchObject({ license: 'UNLICENSED', private: true });
});
