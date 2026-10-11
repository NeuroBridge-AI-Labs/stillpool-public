// Lesson 1.7's build test (its brief, Interactive): T1 to T9 on the committed data, and the known-bad cases that must
// fail. Every result comes from the function; the data file holds inputs only.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { closest, compare, type Dot, differ, learnData, makeDots, minstd, watchItLearn, where } from './watch-it-learn.ts';

const read = (file: string) => learnData.parse(JSON.parse(readFileSync(file, 'utf8')));
const DATA = read('data/interactive/watch-it-learn.json');
const RUN = watchItLearn(DATA);
const counts = (run: typeof RUN, key: 'wrong' | 'newWrong') => run.rounds.map((r) => r[key].length);
const falls = (xs: number[]) => xs.every((x, i) => !i || x < xs[i - 1]);
const neverRises = (xs: number[]) => xs.every((x, i) => !i || x <= xs[i - 1]);

const t1 = (a?: number) => {
  const next = minstd(1, a);
  for (let i = 1; i < 10_000; i++) next();
  return next();
};
test('T1 the generator: from seed 1 the 10,000th number is the standard\'s known answer; the older multiplier is not', () => {
  expect(t1()).toBe(399268537);
  expect(t1(16807)).toBe(1043618065);
});

test('T2 the dots: 12 pairs then 4 pairs in order, inside the chart, apart, and the first of each where the pack says', () => {
  const kinds = RUN.dots.map((d) => `${d.new ? 'new' : 'example'} ${d.square ? 'square' : 'circle'}`);
  expect(kinds).toEqual([...Array(12).fill(['example circle', 'example square']), ...Array(4).fill(['new circle', 'new square'])].flat());
  expect(RUN.dots.every((d) => Math.abs(d.x) < 4.7 && Math.abs(d.y) < 4.7)).toBe(true);
  expect(RUN.dots.every((d, i) => RUN.dots.slice(i + 1).every((e) => Math.hypot(d.x - e.x, d.y - e.y) >= 0.5))).toBe(true);
  expect([RUN.dots[0].x, RUN.dots[0].y, RUN.dots[24].x, RUN.dots[24].y].map((v) => v.toFixed(6))).toEqual(['-1.515718', '-0.609015', '0.318975', '-2.085976']);
});

// T3: both losses fall in every round.
const t3 = (run: typeof RUN) => falls(run.rounds.map((r) => r.loss)) && falls(run.rounds.map((r) => r.newLoss));
test('T3 both losses fall in every round; the gradient added, or a step size of 100, makes them rise', () => {
  expect(t3(RUN)).toBe(true);
  // The new-dot loss is taken on the new dots, not the example dots (review N1): round 0's two losses, pinned.
  expect([RUN.rounds[0].loss, RUN.rounds[0].newLoss].map((v) => v.toFixed(4))).toEqual(['0.8469', '0.7844']);
  expect(t3(watchItLearn({ ...DATA, rate: -DATA.rate }))).toBe(false);
  expect(t3(watchItLearn(read('fixtures/bad/watch-it-learn/rate-100.json')))).toBe(false);
});

test('T4 the dots on the wrong side never rise, and fewer are left at the end; nor do the new dots rise', () => {
  const wrong = counts(RUN, 'wrong');
  expect(neverRises(wrong) && wrong.at(-1)! < wrong[0] && neverRises(counts(RUN, 'newWrong'))).toBe(true);
});

// T5: a dot is still wrong at the end, and one shape sits inside a triangle of three of the other, so no line splits them.
const cross = (o: Dot, a: Dot, b: Dot) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const inside = (p: Dot, [a, b, c]: Dot[]) => [cross(a, b, p), cross(b, c, p), cross(c, a, p)].every((v, _, all) => Math.sign(v) === Math.sign(all[0]));
const trapped = (ex: Dot[], square: boolean) => {
  const [own, other] = [ex.filter((d) => d.square === square), ex.filter((d) => d.square !== square)];
  return own.some((p) => other.some((a, i) => other.slice(i + 1).some((b, j) => other.slice(i + j + 2).some((c) => inside(p, [a, b, c])))));
};
const t5 = (run: typeof RUN) => run.rounds.at(-1)!.wrong.length > 0 && [false, true].some((s) => trapped(run.dots.filter((d) => !d.new), s));
test('T5 some dots stay wrong and no straight line can split them; far-apart centres fail it', () => {
  expect(t5(RUN)).toBe(true);
  expect(t5(watchItLearn(read('fixtures/bad/watch-it-learn/far-apart.json')))).toBe(false);
});

test('T6 squares stay above the line, it crosses the chart, and no dot sits within 0.02 of it, in every round', () => {
  for (const { w: [w1, w2, b], ends } of RUN.rounds) {
    expect(w2).toBeGreaterThan(0);
    expect(ends).toHaveLength(2);
    expect(Math.min(...RUN.dots.map((d) => Math.abs(w1 * d.x + w2 * d.y + b) / Math.hypot(w1, w2)))).toBeGreaterThan(0.02);
  }
});

const t7 = (w: [number, number, number]) => {
  const [a, ...others] = Object.values(DATA.candidates).map((c) => differ(c, w, DATA.limit));
  return others.every((o) => a * 2 <= o);
};
test('T7 the line ends closest to A, at most half as far as B or C; the start line is closest to B', () => {
  expect(RUN.closest).toBe('A');
  expect(t7(RUN.rounds.at(-1)!.w)).toBe(true);
  expect(t7(RUN.rounds[0].w)).toBe(false);
  expect(closest(DATA.candidates, RUN.rounds[0].w, DATA.limit)).toBe('B');
});

test('T8 nothing is typed in: the data refuses results or dots, and the function run twice gives the same', () => {
  expect(learnData.safeParse({ ...DATA, results: [] }).success).toBe(false);
  expect(learnData.safeParse({ ...DATA, dots: [] }).success).toBe(false);
  expect(watchItLearn(read('data/interactive/watch-it-learn.json'))).toEqual(RUN);
  expect(makeDots(DATA)).toEqual(RUN.dots);
});

test('T9 the words and where the line runs, by rule', () => {
  expect(compare(2, 3, 4)).toBe('Fewer dots are on the wrong side than after round 3.');
  expect(compare(3, 3, 4)).toBe('As many dots are on the wrong side as after round 3.');
  expect(compare(4, 3, 4)).toBe('More dots are on the wrong side than after round 3.');
  expect(compare(0, 3, 4)).toBe('No dots are on the wrong side.');
  expect(compare(2, 3, 1, 'new dots')).toBe('Fewer new dots are on the wrong side than before training.');
  expect(where([0, 1, 2], 5)).toBe('The line runs from the left edge, below the middle, to the right edge, below the middle.');
  expect(where([1, 0, 0], 5)).toBe('The line runs from the top edge, at the middle, to the bottom edge, at the middle.');
  expect(where([0, 1, -1], 5)).toBe('The line runs from the left edge, at the middle, to the right edge, at the middle.'); // 1 is the middle
  expect(where([1, 1, -1], 5)).toBe('The line runs from the top edge, near the left, to the right edge, near the bottom.');
});
