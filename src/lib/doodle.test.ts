// Lesson 1.9's doodle models (brief T1 to T7; T8 is scripts/train-doodle.test.ts). Each check is a function run on the
// committed files and on its known-bad copy, which must fail with the error it names, so no check passes by default.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { z } from 'astro/zod';
import { expect, test } from 'vitest';
import { lesson } from '../lesson-schema.ts';
import { chances, guess, prepare, render, words, type Drawing, type Model } from './doodle.ts';

const sha = (t: string) => createHash('sha256').update(t).digest('hex');
// Copied once from the script's printed output (P6.21 PR body), never from the files.
const PIN = {
  six: '8a9e5486c1771fd226ccaf6bfe6e7c800aef8c38408105b8eda76db8cc1b5e0c',
  three: '7614cb5ad0909f86132d6c8e2b1463728df3f079e6312f178f8699bd017910c7',
  data: 'b9278c64b17f264aa06464bfedd37de7d37f09757340b968e8915468873721c6',
};
const read = (f: string) => readFileSync(f, 'utf8');
const TEXT = { six: read('data/doodle/six-kinds.weights.json'), three: read('data/doodle/three-kinds.weights.json'), data: read('data/interactive/doodle-guesser.json') };
const [SIX, THREE] = [JSON.parse(TEXT.six) as Model, JSON.parse(TEXT.three) as Model];
const clone = (): Data => JSON.parse(TEXT.data);
const DATA = clone();
// Pack I4, typed from the pack: each kind's pin, then its learning and testing line ranges.
const PACK = [
  ['apple', 'd90dec739e92d9e51d5eca58bfb4aee9fceab8c42653bd0850e7a408dc65777e', [2, 2088], [2089, 2613]],
  ['car', 'c618d29401600c6a3adff120b52725b03a84b3eb066fac181d87bdd054c50ff3', [1, 2282], [2283, 2848]],
  ['cat', '0b598e415cf76008ab1ace10d7805cd2e6b6c495c32c19e2c2b083295bfbcdf8', [1, 2373], [2374, 2993]],
  ['fish', 'cc5490bce42f4b0951674fc3455be5b405ac760de0330a7f190bcc1acdccb66b', [1, 2119], [2120, 2649]],
  ['house', '7b8eedd162848f67a40ca7868f7d84dba2815af53f62f4f368f66432448e7553', [1, 2051], [2052, 2565]],
  ['umbrella', '75279c274487d914d57c7374ecb0e476ebbddab888f10a22d328eb87720d3050', [1, 2059], [2060, 2571]],
];
const HOUSE: Drawing = [[[10, 110, 110, 10, 10], [60, 60, 160, 160, 60]], [[0, 60, 120], [60, 0, 60]]];

const four = z.number().refine((v) => /^-?\d+(?:\.\d{1,4})?$/.test(String(v)), 'a finite number, at most 4 decimal places');
const weights = z.object({ kinds: z.array(z.string()).min(1), b: z.array(four), w: z.array(z.array(four).length(784)) }).strict()
  .refine((m) => m.b.length === m.kinds.length && m.w.length === m.kinds.length, 'one bias and one row for each kind');
const [int, hash, point] = [z.int(), z.string().regex(/^[0-9a-f]{64}$/), z.array(z.int().min(0).max(255))];
const drawing = z.array(z.tuple([point, point]));
const count = z.object({ right: int, total: int }).strict();
const before = z.union([z.object({ line: int, recognized: z.literal(true), drawing }).strict(), z.object({ line: int, recognized: z.literal(false) }).strict()]);
const data = z.object({
  slice: z.array(z.object({ kind: z.string(), address: z.url(), bytes: z.literal(4194304), sha256: hash, learning: z.tuple([int, int]), testing: z.tuple([int, int]) }).strict()),
  copyKinds: z.array(z.string()),
  heldBack: z.object({ six: count, three: count }).strict(),
  countries: z.object({ count: int, top: z.array(z.object({ code: z.string(), n: int }).strict()).length(5) }).strict(),
  examples: z.array(z.object({ kind: z.string(), line: int, drawing, before: z.array(before) }).strict()).length(3),
  skipped: z.array(z.object({ kind: z.string(), line: int, reason: z.string().min(1) }).strict()),
  weights: z.object({ six: hash, three: hash }).strict(),
}).strict();
type Data = z.infer<typeof data>;

const lit = (p: number[]) => [p.filter((v) => v > 0).length, Math.max(...p).toFixed(6), p.reduce((s, v) => s + v, 0).toFixed(6)];
test("T1 the drawing rule gives the pack's known answers", () => {
  const dot = render([[[0], [0]]]);
  expect(dot.flatMap((v, i) => (v > 0 ? [[Math.floor(i / 28) + 1, (i % 28) + 1]] : []))).toEqual([[14, 14], [14, 15], [15, 14], [15, 15]]);
  expect([dot, render([[[0, 255], [0, 0]]]), render([[[0, 0, 255], [0, 255, 255]]])].map(lit)).toEqual(
    [[4, '0.529735', '2.118941'], [52, '0.736842', '36.688313'], [100, '0.993421', '71.128191']]);
});

test('T2 prepare() moves to 0, scales to 255 and rounds halves up; T3 chances in words', () => {
  expect([prepare([[[10, 110], [20, 70]]]), prepare([[[37], [91]]])]).toEqual([[[[0, 255], [0, 128]]], [[[0], [0]]]]);
  expect([1, 0.995, 0.9949, 0.945, 0.5, 0.005, 0.0049].map(words)).toEqual(
    ['more than 99 in 100', 'more than 99 in 100', '99 in 100', '95 in 100', '50 in 100', '1 in 100', 'less than 1 in 100']);
});

const t4 = (six: Model, three: Model) => {
  if (six.kinds.join() !== 'apple,car,cat,fish,house,umbrella' || three.kinds.join() !== 'apple,house,umbrella') throw new Error("T4: the kinds are not the brief's");
  for (const m of [six, three])
    for (const d of [...DATA.examples.map((e) => e.drawing), prepare(HOUSE)]) {
      const p = chances(m, render(d));
      expect(Math.abs(p.reduce((s, v) => s + v, 0) - 1)).toBeLessThan(1e-12);
      expect(p[guess(p)]).toBe(Math.max(...p));
    }
};
test('T4 the chances add up to 1, the guess is the biggest, and the copy can never name car, cat or fish', () => {
  t4(SIX, THREE);
  expect(guess([0.25, 0.5, 0.5, 0])).toBe(1);
  expect(() => t4(SIX, { ...THREE, kinds: [...THREE.kinds, 'cat'] })).toThrow("T4: the kinds are not the brief's");
});

const t5 = (name: 'six' | 'three', text: string) => {
  if (sha(text) !== PIN[name] || sha(text) !== DATA.weights[name]) throw new Error(`T5: ${name} is not the file the script wrote`);
  weights.parse(JSON.parse(text));
  expect(gzipSync(text).length).toBeLessThan(30000);
};
test('T5 the weights are the ones the script wrote, unchanged', () => {
  t5('six', TEXT.six);
  t5('three', TEXT.three);
  const changed = JSON.parse(TEXT.six) as Model;
  changed.w[0][300] = Math.round((changed.w[0][300] + 0.0001) * 1e4) / 1e4;
  expect(() => t5('six', `${JSON.stringify(changed)}\n`)).toThrow('T5: six is not the file the script wrote');
  expect(() => weights.parse({ ...SIX, b: [...SIX.b.slice(1), 0.00001] })).toThrow('at most 4 decimal places');
});

// The lesson's words about our models: "most" and "some wrong" (F10), and "more from the US" (F24).
const wordsGuard = ({ heldBack: { six }, countries }: Data) => {
  if (!(six.right > six.total / 2 && six.right < six.total)) throw new Error('T6: "most" and "some wrong" do not hold');
  if (countries.top[0].code !== 'US') throw new Error('T6: the US is not first');
};
test("T6 the data file is the one the script wrote, and the lesson's words hold for it", () => {
  expect(sha(TEXT.data)).toBe(PIN.data);
  data.parse(DATA);
  expect(DATA.slice.map((s) => [s.kind, s.sha256, s.learning, s.testing])).toEqual(PACK);
  expect([DATA.examples.map((e) => e.kind), DATA.copyKinds]).toEqual([['car', 'cat', 'fish'], THREE.kinds]);
  wordsGuard(DATA);
  const bad = clone();
  Object.assign(bad.examples[0], { chances: [1] });
  expect(() => data.parse(bad)).toThrow(`Unrecognized key: \\"chances\\"`);
  for (const right of [DATA.heldBack.six.total, DATA.heldBack.six.total / 2])
    expect(() => wordsGuard({ ...DATA, heldBack: { ...DATA.heldBack, six: { ...DATA.heldBack.six, right } } })).toThrow('T6: "most" and "some wrong" do not hold');
});

// I8, replayed here, not through the script: each example is the first testing line the six-kind model gives its own
// kind 0.9 or more, after the recorded skips.
const replay = (d: Data) => {
  for (const e of d.examples) {
    const passes = (dr?: Drawing) => !!dr && chances(SIX, render(dr))[SIX.kinds.indexOf(e.kind)] >= 0.9;
    const start = d.slice.find((s) => s.kind === e.kind)?.testing[0] ?? NaN;
    if ([...e.before.map((b) => b.line), e.line].some((l, i) => l !== start + i)) throw new Error(`T7: ${e.kind} is not a run from its testing range's first line`);
    const skipped = d.skipped.filter((s) => s.kind === e.kind);
    const drawn = (line: number) => e.before.find((b) => b.line === line && b.recognized) as { drawing: Drawing } | undefined;
    for (const b of e.before)
      if (passes(drawn(b.line)?.drawing) && !skipped.some((s) => s.line === b.line)) throw new Error(`T7: ${e.kind} line ${b.line} passes the rule first`);
    if (!passes(e.drawing)) throw new Error(`T7: the ${e.kind} example does not pass the rule`);
    for (const s of skipped) if (!passes(drawn(s.line)?.drawing)) throw new Error(`T7: skipped ${e.kind} line ${s.line} is not a passing line before the example`);
  }
};
test("T7 each example is the first line that passes I8's rule, after the recorded skips", () => {
  replay(DATA);
  const [learning, later, after] = [clone(), clone(), clone()];
  learning.examples[1].line = 2373;
  expect(() => replay(learning)).toThrow("T7: cat is not a run from its testing range's first line");
  Object.assign(later.examples[0], { line: 2284, before: [{ line: 2283, recognized: true, drawing: later.examples[0].drawing }] });
  expect(() => replay(later)).toThrow('T7: car line 2283 passes the rule first');
  after.skipped = [{ kind: 'fish', line: 2124, reason: 'a made-up skip' }];
  expect(() => replay(after)).toThrow('T7: skipped fish line 2124 is not a passing line before the example');
});

test('inputs: a file name may hold dots, never a .. segment, and needs an extension (pack CR4)', () => {
  const ok = (f: string) => lesson.shape.inputs.safeParse([f]).success;
  expect(['data/doodle/six-kinds.weights.json', 'data/doodle/three-kinds.weights.json'].map(ok)).toEqual([true, true]);
  expect(['data/../NOTICE', 'data/doodle/.weights.json', 'data/doodle'].map(ok)).toEqual([false, false, false]);
});
