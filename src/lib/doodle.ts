// Lesson 1.9's doodle models (brief, Interactive; pack I5, I6, I9, I10): pure functions shared by the training script,
// the build, the page and the tests, in plain double-precision arithmetic. Training lives in scripts/train-doodle.ts.

// A drawing as the Quick, Draw! simplified files hold it: strokes, each [xs, ys].
export type Drawing = number[][][];
export type Model = { kinds: string[]; b: number[]; w: number[][] };

const R = (8 * 28) / 304; // the line's half-width in pixels (I5)

// I5: centre the drawing's box in 256 by 256, map it onto 28 by 28, and ink each pixel by its distance to the strokes
// (to the point itself for a one-point stroke). The 784 values go row by row, top row first.
export function render(drawing: Drawing): number[] {
  const [W, H] = [0, 1].map((a) => Math.max(...drawing.flatMap((s) => s[a])));
  const to = (v: number, size: number) => ((v + (256 - size) / 2 + 24) * 28) / 304;
  const strokes = drawing.map(([xs, ys]) => xs.map((x, i) => [to(x, W), to(ys[i], H)]));
  const pixels: number[] = [];
  for (let row = 0; row < 28; row++)
    for (let col = 0; col < 28; col++) {
      const [px, py] = [col + 0.5, row + 0.5];
      let d = Infinity;
      for (const s of strokes)
        for (let i = 0; i < s.length; i++) {
          const [[ax, ay], [bx, by]] = [s[i], s[Math.min(i + 1, s.length - 1)]];
          const [dx, dy] = [bx - ax, by - ay];
          const len = dx * dx + dy * dy;
          const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
          d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
        }
      pixels.push(Math.min(1, Math.max(0, R + 0.5 - d)));
    }
  return pixels;
}

// I9: the learner's strokes, moved to 0 and scaled evenly so the largest value is 255, halves rounded up.
export function prepare(drawing: Drawing): Drawing {
  const [xs, ys] = [0, 1].map((a) => drawing.flatMap((s) => s[a]));
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const fit = (v: number, min: number) => (span === 0 ? 0 : Math.round(((v - min) * 255) / span));
  return drawing.map(([x, y]) => [x.map((v) => fit(v, minX)), y.map((v) => fit(v, minY))]);
}

// The weights times the 784 values plus the bias, then softmax with the largest total subtracted first.
export function chances(model: Model, pixels: number[]): number[] {
  const totals = model.w.map((w, k) => w.reduce((s, wj, j) => s + wj * pixels[j], model.b[k]));
  const e = totals.map((t) => Math.exp(t - Math.max(...totals)));
  const sum = e.reduce((s, v) => s + v, 0);
  return e.map((v) => v / sum);
}

// The guess is the biggest chance, a tie going to the first kind in the model's order.
export const guess = (p: number[]) => p.reduce((best, v, i) => (v > p[best] ? i : best), 0);

// The list: the three biggest chances in order, then the rest summed. Only the six-kind model has a rest, of three kinds.
export function rows(model: Model, p: number[]) {
  const order = p.map((_, i) => i).sort((a, b) => p[b] - p[a] || a - b);
  const top = order.slice(0, 3).map((i) => ({ kind: model.kinds[i], chance: p[i] }));
  const rest = { kind: 'the other three kinds together', chance: order.slice(3).reduce((s, i) => s + p[i], 0) };
  return order.length > 3 ? [...top, rest] : top;
}

// I10: a chance in words, never a percentage. N is 100 p rounded, halves up; toFixed first, so 0.945 is a half.
export function words(p: number): string {
  if (p >= 0.995) return 'more than 99 in 100';
  if (p < 0.005) return 'less than 1 in 100';
  return `${Math.round(Number((p * 100).toFixed(6)))} in 100`;
}

// The rule lines (brief, Interactive), fixed words with values from the build.
export const named = (kind: string, guessed: string) => `The model named ${guessed === kind ? 'what the doodle shows' : 'something else'}.`;
export const copyNamed = (kind: string, guessed: string) =>
  `The copy never learned from a doodle of a ${kind}. Its only answers are apple, house and umbrella, so it named ${guessed}.`;
export const highChance = (guessed: string, p: number) => (p >= 0.9 ? `It gave ${guessed} a high chance, and that is still not what the doodle shows.` : '');
