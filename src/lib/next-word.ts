// Lesson 1.4's toy (pack T3, F9, F13, I3, I5): a word-counting (trigram) model of one book, data/training/dubliners.txt.
// Pure functions: the build and the tests call them, and the page ships only their results.

// I3: the temperatures the page offers.
export const TEMPS = { Low: 0.5, Standard: 1, High: 2 };

// T3: lower case, curly apostrophes straight; a piece is a run of letters (an apostrophe inside) or one of six marks.
export const pieces = (text: string): string[] =>
  text.normalize('NFC').replace(/[‘’]/g, "'").toLowerCase().match(/\p{L}+(?:'\p{L}+)*|[.,;:!?]/gu) ?? [];

// F9: every piece seen after the pair a b, with its count, most seen first and ties in alphabetical order. No
// smoothing: a piece never seen after the pair has no entry, so no chance.
export function after(ps: string[], a: string, b: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i + 2 < ps.length; i++) if (ps[i] === a && ps[i + 1] === b) counts.set(ps[i + 2], (counts.get(ps[i + 2]) ?? 0) + 1);
  return new Map([...counts].sort(([x, m], [y, n]) => n - m || (x < y ? -1 : 1)));
}

// F13: each weight to the power 1 over t, rescaled to add up to 1, in the same order.
export function atTemp(weights: Map<string, number>, t: number): Map<string, number> {
  const raised = [...weights].map(([w, x]) => [w, x ** (1 / t)] as const);
  const total = raised.reduce((s, [, x]) => s + x, 0);
  return new Map(raised.map(([w, x]) => [w, x / total]));
}

// I5: a chance in words, from the unrounded chance.
export function words(p: number): string {
  if (p === 1) return 'every time';
  if (p === 0) return 'never';
  if (p >= 0.995) return 'nearly every time';
  if (p < 0.005) return 'less than 1 in 100';
  return `${Math.round(p * 100)} in 100`; // Math.round rounds halves up
}

// T7: r from 0 up to 1 lands on the word whose span holds it, the chances laid end to end in their order.
export function pick(chances: Map<string, number>, r: number): string {
  let end = 0;
  for (const [w, p] of chances) if (r < (end += p)) return w;
  return [...chances.keys()].at(-1) as string; // r past a sum that rounding left just under 1
}

// The R-1.1 part's summary (brief): one rule over the chances of the pieces the model picked, unrounded.
export function spread(chances: number[]): string {
  const high = chances.filter((p) => p >= 0.5).length / chances.length;
  if (high >= 0.6) return 'Most pieces had a high chance: 50 in 100 or more.';
  if (high <= 0.4) return 'Most pieces had a lower chance: under 50 in 100.';
  return 'About half the pieces had a chance of 50 in 100 or more.';
}
