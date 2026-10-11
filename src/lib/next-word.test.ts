// Lesson 1.4's toy (brief T1 to T4 and T7), and the brief's T6 scoped to 1.4 (p6 Wave F). Each check is a function run
// on the real toy and on its known-bad case, so a check that cannot fail shows up here.
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { after, atTemp, pick, pieces, TEMPS, words } from './next-word.ts';

type Chances = (weights: Map<string, number>, t: number) => Map<string, number>;
const BOOK = readFileSync('data/training/dubliners.txt');
const PS = pieces(BOOK.toString('utf8'));
const DATA = JSON.parse(readFileSync('data/interactive/next-word.json', 'utf8')) as { starts: { text: string; guesses: string[] }[] };
// Pack section 4, measured by build.py and re-counted by crosscheck.mjs: each start's pair, times seen, top five in order.
const PACK: [string, number, [string, number][]][] = [
  ['the old', 73, [['man', 35], ['gentleman', 5], ['country', 3], ['priest', 2], ['woman', 2]]],
  ['there was', 71, [['a', 24], ['no', 13], ['something', 8], ['nothing', 4], ['one', 2]]],
  ['cup of', 1, [['beef', 1]]],
];

const t1 = (book: Buffer) => {
  expect(createHash('sha256').update(book).digest('hex')).toBe('eb3fc36a11c9159f3d77a7a6ad1f17f2b8f9411030229c107ef6d2a8e2dc94ac');
  expect(book.length).toBe(385954);
};

test("T1 the training text is the pinned body of Dubliners, and the toy gives the pack's counts", () => {
  t1(BOOK);
  expect(BOOK.toString('utf8').split('Gutenberg').length - 1).toBe(0);
  expect(PS.length).toBe(77243);
  // p6-7-review S5: the lesson's "about 3 in 4 of the pairs the toy saw appear only once" (F10), each pair a context.
  const pairs = new Map<string, number>();
  for (let i = 0; i + 2 < PS.length; i++) pairs.set(`${PS[i]} ${PS[i + 1]}`, (pairs.get(`${PS[i]} ${PS[i + 1]}`) ?? 0) + 1);
  expect([pairs.size, [...pairs.values()].filter((n) => n === 1).length]).toEqual([37076, 28238]);
  for (const [i, [pair, seen, top]] of PACK.entries()) {
    const { text, guesses } = DATA.starts[i];
    const last = pieces(text).slice(-2);
    const counts = after(PS, last[0], last[1]);
    expect(last.join(' ')).toBe(pair);
    expect([...counts.values()].reduce((s, n) => s + n, 0), pair).toBe(seen);
    expect([...counts].slice(0, 5), pair).toEqual(top);
    // I4: the guess buttons are alphabetical, and the ones the toy saw are its top five.
    expect(guesses).toEqual(guesses.toSorted());
    expect(guesses.filter((g) => counts.has(g))).toEqual(top.map(([w]) => w).toSorted());
  }
});

test('T1 known-bad: the text with its last byte changed fails', () => {
  const bad = Buffer.from(BOOK);
  bad[bad.length - 1] ^= 1;
  expect(() => t1(bad)).toThrow();
});

// Shares no code with the toy: a case-free search of the text, any spaces or line breaks between the words.
const t2 = (chances: Chances) => {
  const raw = BOOK.toString('utf8');
  const count = (re: RegExp) => raw.match(re)?.length ?? 0;
  expect([count(/\bthere\s+was\s+a\b/gi), count(/\bthe\s+old\s+man\b/gi), count(/\bcup\s+of\b/gi)]).toEqual([24, 35, 1]);
  for (const t of Object.values(TEMPS)) {
    const c = chances(after(PS, 'cup', 'of'), t);
    expect([words(c.get('beef') ?? 0), words(c.get('tea') ?? 0)], `temperature ${t}`).toEqual(['every time', 'never']);
  }
};

test('T2 an independent count agrees, and after "cup of" beef is every time and tea never, at every temperature', () => {
  t2(atTemp);
});

test('T2 known-bad: a toy that smooths unseen words fails', () => {
  const vocab = [...new Set(PS)];
  expect(() => t2((w, t) => atTemp(new Map(vocab.map((v) => [v, (w.get(v) ?? 0) + 1])), t))).toThrow();
});

// SLP3 Fig. 7.21's logits; e to each logit is softmax before its rescale, so atTemp gives softmax(logit / t).
const t3 = (chances: Chances) => {
  const logits = new Map(Object.entries({ all: 1.2, the: 0.9, your: 0.1, that: -0.5 }).map(([w, l]) => [w, Math.exp(l)] as const));
  expect([1, 0.5, 0.1].map((t) => chances(logits, t).get('all')?.toFixed(2))).toEqual(['0.44', '0.59', '0.95']);
};

test("T3 the temperature rule reproduces SLP3's worked example", () => {
  t3(atTemp);
});

test('T3 known-bad: the temperature multiplied instead of divided fails', () => {
  expect(() => t3((w, t) => atTemp(w, 1 / t))).toThrow();
});

test('T4 a chance in words, halves rounding up', () => {
  const cases: [number, string][] = [
    [1, 'every time'],
    [0.9999, 'nearly every time'],
    [0.995, 'nearly every time'],
    [0.4795, '48 in 100'],
    [0.125, '13 in 100'],
    [0.005, '1 in 100'],
    [0.0031, 'less than 1 in 100'],
    [0, 'never'],
  ];
  for (const [p, said] of cases) expect(words(p), String(p)).toBe(said);
});

// Over every next word laid end to end in the toy's order: at Standard "a" runs to 0.338 and "no" to 0.521; at High
// "a" and "no" end at 0.253 and "something" runs to 0.338. At Standard the top five end at 0.718 and "silence" runs to
// 0.746, so the last draw lands past the five (p6-8-review S1).
const t7 = (draw: (chances: Map<string, number>, r: number) => string) => {
  const was = after(PS, 'there', 'was');
  const [standard, high] = [atTemp(was, TEMPS.Standard), atTemp(was, TEMPS.High)];
  expect([draw(standard, 0.3), draw(standard, 0.4), draw(high, 0.3), draw(standard, 0.72)]).toEqual(['a', 'no', 'something', 'silence']);
};

test('T7 the pick draws over every next word at the current chances', () => {
  t7(pick);
});

test('T7 known-bad: a draw over the five shown words only fails', () => {
  expect(() => t7((c, r) => pick(atTemp(new Map([...c].slice(0, 5)), 1), r))).toThrow();
});

// T6 scoped to 1.4: no chance typed into the lesson folder or the interactive's data, so every chance on the page
// comes from the build. URLs are stripped first. ponytail: no id strip; the decimal form's lookbehind skips every dot
// inside an id or a DOI, and the whole competency register is the known-good case (p6-8-review S2).
const CHANCE = [/\b\d{1,3} in 100\b/gi, /\b(?:nearly )?every time\b/gi, /\bless than 1 in 100\b/gi, /(?<![\w.-])0?\.\d+\b/g];
const chances = (text: string, forms = CHANCE) => {
  const bare = text.replace(/https?:\/\/\S+/g, ' ');
  return forms.flatMap((re) => bare.match(re) ?? []);
};
// p6-8-review N1: a percentage is a chance too, banned in the data only (the lesson quotes survey percentages).
const DATA_CHANCE = [...CHANCE, /\d+(?:\.\d+)?\s?%/g];

test('T6 the lesson folder and the interactive data hold no chance', () => {
  const files = [...globSync('content/how-ai-works/the-next-word/**/*.*'), 'data/interactive/next-word.json'];
  expect(files.length).toBeGreaterThanOrEqual(3);
  for (const file of files) expect(chances(readFileSync(file, 'utf8'), file.startsWith('data/') ? DATA_CHANCE : CHANCE), file).toEqual([]);
});

test("T6 known-bad: 48 in 100 typed into the data fails; good: 1.1's real ids, DOIs and prose stay silent", () => {
  expect(chances(readFileSync('fixtures/bad/next-word/next-word.json', 'utf8'))).toEqual(['48 in 100']);
  expect(chances(readFileSync('content/how-ai-works/what-ai-is-and-is-not/index.mdx', 'utf8'))).toEqual([]);
  expect(chances('https://example.org/a?t=.5')).toEqual([]);
  expect(chances('"top": "man 48%"', DATA_CHANCE)).toEqual(['48%']);
});

test('T6 good: every competency id in the register is silent', () => {
  const ids = readFileSync('docs/curriculum/competencies.yaml', 'utf8').match(/[A-Z]+-[A-Za-z0-9.-]+/g) ?? [];
  expect(ids.length).toBeGreaterThan(100);
  expect(chances(ids.join('\n'))).toEqual([]);
});
