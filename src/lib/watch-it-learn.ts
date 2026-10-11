// Lesson 1.7's "Watch it learn" (its brief, Interactive), run at build time: the dots from a fixed seed, every round of
// gradient descent on a line with three numbers, and every word the page shows. The browser computes nothing.
import { z } from 'astro/zod';

const two = z.tuple([z.number(), z.number()]);
const line = z.tuple([z.number(), z.number(), z.number()]);
// Inputs only, strict, so no result can be typed into the file.
export const learnData = z
  .object({
    seed: z.int().positive(), limit: z.number().positive(), edge: z.number().min(0), gap: z.number().positive(), spread: z.number().positive(),
    centres: z.object({ circle: two, square: two }).strict(),
    examples: z.int().positive(), new: z.int().min(0), start: line, rate: z.number().positive(), rounds: z.int().positive(),
    candidates: z.record(z.string().regex(/^[A-Z]$/), line),
  })
  .strict();
type Data = z.infer<typeof learnData>;
type Line = [number, number, number];
type Point = { x: number; y: number };
export type Dot = Point & { square: boolean; new: boolean };

// minstd_rand, the C++ standard's: x = 48271 x mod (2^31 - 1), exact in JavaScript numbers.
const M = 2147483647;
export const minstd = (x: number, a = 48271) => () => (x = (a * x) % M);

// Pairs of example dots (a circle, then a square), then pairs of new dots; a try that is near the edge or near a kept dot
// is drawn again with six new numbers.
export function makeDots({ seed, limit, edge, gap, spread, centres, examples, new: fresh }: Data) {
  const next = minstd(seed);
  const u = () => next() / M;
  const dots: Dot[] = [];
  for (const isNew of [false, true])
    for (let i = 0; i < (isNew ? fresh : examples); i++)
      for (const square of [false, true]) {
        const [cx, cy] = square ? centres.square : centres.circle;
        for (;;) {
          const x = cx + spread * (u() + u() + u() - 1.5);
          const y = cy + spread * (u() + u() + u() - 1.5);
          const far = dots.every((d) => (x - d.x) * (x - d.x) + (y - d.y) * (y - d.y) >= gap * gap);
          if (Math.abs(x) < limit - edge && Math.abs(y) < limit - edge && far) {
            dots.push({ x, y, square, new: isNew });
            break;
          }
        }
      }
  return dots;
}

export const score = ([w1, w2, b]: Line, p: Point) => w1 * p.x + w2 * p.y + b;
// A score above 0 puts a dot on the square side; the line is where the score is 0.
const wrong = (w: Line, d: Dot) => score(w, d) > 0 !== d.square;
const softplus = (v: number) => Math.max(v, 0) + Math.log1p(Math.exp(-Math.abs(v)));
const loss = (w: Line, ds: Dot[]) => ds.reduce((s, d) => s + softplus(d.square ? -score(w, d) : score(w, d)), 0) / ds.length;
const step = (w: Line, ds: Dot[], rate: number) => {
  const g = [0, 0, 0];
  for (const d of ds) {
    const e = 1 / (1 + Math.exp(-score(w, d))) - (d.square ? 1 : 0);
    [d.x * e, d.y * e, e].forEach((v, i) => (g[i] += v));
  }
  return w.map((v, i) => v - rate * (g[i] / ds.length)) as Line;
};

// Where the line meets the chart's edge, left one first (the higher first if both share an x); a corner is left or right.
export function ends([w1, w2, b]: Line, L: number) {
  const out: [string, number, number][] = [];
  if (w2) for (const x of [-L, L]) if (Math.abs(-(w1 * x + b) / w2) <= L) out.push([x < 0 ? 'left' : 'right', x, -(w1 * x + b) / w2]);
  if (w1) for (const y of [L, -L]) if (Math.abs(-(w2 * y + b) / w1) < L) out.push([y > 0 ? 'top' : 'bottom', -(w2 * y + b) / w1, y]);
  return out.sort((p, q) => p[1] - q[1] || q[2] - p[2]);
}
const place = (v: number, [a, b, mid, c, d]: string[]) => (v < -3 ? a : v < -1 ? b : v <= 1 ? mid : v <= 3 ? c : d);
const BY_Y = ['near the bottom', 'below the middle', 'at the middle', 'above the middle', 'near the top'];
const BY_X = ['near the left', 'left of the middle', 'at the middle', 'right of the middle', 'near the right'];
export const where = (w: Line, L: number) =>
  `The line runs from ${ends(w, L).map(([e, x, y]) => `the ${e} edge, ${e === 'top' || e === 'bottom' ? place(x, BY_X) : place(y, BY_Y)}`).join(', to ')}.`;

const since = (r: number) => (r === 1 ? 'before training' : `after round ${r - 1}`);
export const compare = (now: number, before: number, r: number, noun = 'dots') =>
  now === 0
    ? `No ${noun} are on the wrong side.`
    : `${now < before ? 'Fewer' : now > before ? 'More' : 'As many'} ${noun} are on the wrong side ${now === before ? 'as' : 'than'} ${since(r)}.`;

// On the 441 grid points from -5 to 5 in steps of 0.5, how many two lines put on different sides.
export function differ(a: Line, b: Line, L: number) {
  let n = 0;
  for (let i = 0; i <= 4 * L; i++) for (let j = 0; j <= 4 * L; j++) n += Number(score(a, { x: -L + 0.5 * i, y: -L + 0.5 * j }) > 0 !== score(b, { x: -L + 0.5 * i, y: -L + 0.5 * j }) > 0);
  return n;
}
export const closest = (candidates: Record<string, Line>, w: Line, L: number) =>
  Object.entries(candidates).reduce((best, c) => (differ(c[1], w, L) < differ(best[1], w, L) ? c : best))[0];

export function watchItLearn(data: Data) {
  const dots = makeDots(data);
  const [ex, fresh] = [dots.filter((d) => !d.new), dots.filter((d) => d.new)];
  let w = data.start as Line;
  const runs = Array.from({ length: data.rounds + 1 }, (_, r) => {
    if (r) w = step(w, ex, data.rate);
    const off = (isNew: boolean) => dots.flatMap((d, i) => (d.new === isNew && wrong(w, d) ? [i] : []));
    return { r, w, wrong: off(false), newWrong: off(true), loss: loss(w, ex), newLoss: loss(w, fresh), ends: ends(w, data.limit), where: where(w, data.limit) };
  });
  const rounds = runs.map((now, r) => {
    const p = runs[r - 1];
    if (!p) return { ...now, words: 'Before training. Ringed dots are on the wrong side of the line.', deep: '' };
    const how = now.loss < p.loss ? 'less than' : now.loss > p.loss ? 'more than' : 'the same as';
    const [a, b, c] = now.w.map((v) => v.toFixed(2));
    return {
      ...now,
      words: `Round ${r}. ${compare(now.wrong.length, p.wrong.length, r)}`,
      deep: `How wrong the guesses are: ${how} ${since(r)}. ${compare(now.newWrong.length, p.newWrong.length, r, 'new dots')} The model's three numbers: ${a}, ${b} and ${c}.`,
    };
  });
  return { dots, rounds, closest: closest(data.candidates, w, data.limit) };
}
