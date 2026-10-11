// 3.2's "Sort the dataset": a tiny model retrained in the browser on invented fruit (pack I2 to I9). Ambers and brills are
// sorted ripe or not from one squeeze score, 1 (hard) to 10 (soft). The truth: an amber is ripe from 5, a brill from 7.
// The model learns one cut-off t (1 to 11): a fruit is sorted ripe at score t or more. Training picks the t with the
// fewest mistakes on its examples, and the lowest t on a tie. Whole numbers only and no randomness, so every run of the
// same data gives the same result, in the build and in the browser. A toy: it shows one effect, not any real system.
export type Kind = 'amber' | 'brill';
export type Example = { kind: Kind; score: number };

export const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);
export const CUTOFFS = Array.from({ length: 11 }, (_, i) => i + 1);
export const RIPE_FROM: Record<Kind, number> = { amber: 5, brill: 7 };
export const AMBERS_PER_SCORE = 2;
export const TEST_PER_SCORE = 2; // 20 ambers and 20 brills, never trained on
export const KINDS: Kind[] = ['amber', 'brill'];

export const isRipe = (e: Example) => e.score >= RIPE_FROM[e.kind];
const many = (kind: Kind, per: number): Example[] => SCORES.flatMap((score) => Array.from({ length: per }, () => ({ kind, score })));
// The training examples: 20 ambers, and `brillsPer` brills at each score (the one data choice).
export const training = (brillsPer: number): Example[] => [...many('amber', AMBERS_PER_SCORE), ...many('brill', brillsPer)];
export const testSet = (): Example[] => [...many('amber', TEST_PER_SCORE), ...many('brill', TEST_PER_SCORE)];

const wrong = (t: number, e: Example) => e.score >= t !== isRipe(e);
// Mistakes on the examples at each cut-off 1 to 11.
export const mistakes = (data: Example[]): Record<number, number> => Object.fromEntries(CUTOFFS.map((t) => [t, data.filter((e) => wrong(t, e)).length]));
// The cut-off with the fewest mistakes; the lowest of any tie.
export function train(data: Example[]): number {
  const m = mistakes(data);
  return CUTOFFS.reduce((best, t) => (m[t] < m[best] ? t : best), CUTOFFS[0]);
}

export type Result = { cutoff: number; amber: Tally; brill: Tally; overall: Tally };
export type Tally = { wrong: number; total: number; scores: number[] };
const tally = (cutoff: number, set: Example[]): Tally => {
  const bad = set.filter((e) => wrong(cutoff, e));
  return { wrong: bad.length, total: set.length, scores: [...new Set(bad.map((e) => e.score))] };
};
// Train on the examples, then test on the test set: errors for each kind and overall.
export function run(brillsPer: number): Result {
  const cutoff = train(training(brillsPer));
  const test = testSet();
  return { cutoff, amber: tally(cutoff, test.filter((e) => e.kind === 'amber')), brill: tally(cutoff, test.filter((e) => e.kind === 'brill')), overall: tally(cutoff, test) };
}

// In words, never as a percentage and never "N of M": "4 wrong in 20, about 1 in 5".
export const wrongIn = ({ wrong: n, total }: Tally) => (n ? `${n} wrong in ${total}, about 1 in ${Math.round(total / n)}` : `0 wrong in ${total}`);
const and = (xs: number[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
export const NAME: Record<Kind, string> = { amber: 'Ambers', brill: 'Brills' };
// The result as lines of words: the cut-off, each kind, the overall, and which fruit were wrong and why.
export function lines(r: Result): string[] {
  const miss = (k: Kind) =>
    r[k].wrong ? `${NAME[k]} it got wrong had scores ${and(r[k].scores)}: ${k === 'amber' ? 'ripe, sorted not ripe' : 'not ripe, sorted ripe'}.` : '';
  return [
    `The model learned a cut-off: a fruit is sorted ripe at score ${r.cutoff} or more.`,
    `Ambers: ${wrongIn(r.amber)}.`,
    `Brills: ${wrongIn(r.brill)}.`,
    ...KINDS.map(miss).filter(Boolean),
    `Overall: ${wrongIn(r.overall)}.`,
  ];
}
// The kind it got wrong more often, or "same".
export const worse = (r: Result): Kind | 'same' => (r.amber.wrong === r.brill.wrong ? 'same' : r.amber.wrong > r.brill.wrong ? 'amber' : 'brill');

const LOWER: Record<Kind, string> = { amber: 'ambers', brill: 'brills' };
// What we say of a guess, in words: "ambers", "brills" or "same".
export function verdict(pick: Kind | 'same', r: Result): string {
  const w = worse(r);
  const said = pick === 'same' ? 'You said about the same.' : `You said ${LOWER[pick]}.`;
  if (w === 'same') return `${said} The two kinds were wrong equally often.`;
  if (pick === w) return `${said} It did get ${LOWER[w]} wrong more often.`;
  return `${said} It got ${LOWER[w]} wrong more often.`;
}
// The overall line before and after the change: the same number, with the group that was wrong changed.
export const compare = (a: Result, b: Result) =>
  a.overall.wrong === b.overall.wrong
    ? `The overall line is the same both times: ${wrongIn(a.overall)}. The overall number did not change. Who was wrong did.`
    : `The overall line changed from ${wrongIn(a.overall)} to ${wrongIn(b.overall)}.`;
export const LIMITS = [
  'This is a toy with invented fruit. It learns one number. Real systems use many features and many more examples. It shows one effect, not a model of any real system.',
  'In our toy, no single cut-off is right for both kinds. A different design, such as one rule for each kind, is another choice. The toy does not show it.',
  'More data about a group does not always move mistakes to another group. It shows that when one rule has to serve two groups that differ, the data decides whose pattern it follows.',
];
