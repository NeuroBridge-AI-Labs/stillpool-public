import { expect, test } from 'vitest';
import { CLOSE, VERY_CLOSE, cosine, inWords, rank } from './find-then-answer';

const q = [1, 0];
const near = { term: 'near', lesson: 'a', vector: [1, 0.1] };
const far = { term: 'far', lesson: 'b', vector: [0.1, 1] };

test('cosine: identical vectors give 1, orthogonal give 0, opposite give -1', () => {
  expect(cosine([3, 4], [3, 4])).toBeCloseTo(1);
  expect(cosine([1, 0], [0, 1])).toBe(0);
  expect(cosine([1, 2], [-1, -2])).toBeCloseTo(-1);
});

test('rank: the closer vector comes first, and swapping the vectors swaps the order', () => {
  expect(rank(q, [far, near]).map((m) => m.term)).toEqual(['near', 'far']);
  const swapped = [{ ...near, vector: far.vector }, { ...far, vector: near.vector }];
  expect(rank(q, swapped).map((m) => m.term)).toEqual(['far', 'near']);
});

test('rank: returns the term, lesson and similarity of the top five only', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ term: `t${i}`, lesson: 'l', vector: [1, i] }));
  const top = rank(q, many);
  expect(top.map((m) => m.term)).toEqual(['t0', 't1', 't2', 't3', 't4']);
  expect(top[0]).toEqual({ term: 't0', lesson: 'l', similarity: 1 });
});

test('rank: ties keep the input order, both ways round', () => {
  const [a, b] = [{ term: 'a', lesson: 'l', vector: [1, 1] }, { term: 'b', lesson: 'l', vector: [2, 2] }];
  expect(rank(q, [a, b]).map((m) => m.term)).toEqual(['a', 'b']);
  expect(rank(q, [b, a]).map((m) => m.term)).toEqual(['b', 'a']);
});

test('inWords: three bands, each edge belongs to the closer band', () => {
  expect(inWords(VERY_CLOSE)).toBe('very close');
  expect(inWords(VERY_CLOSE - 0.001)).toBe('close');
  expect(inWords(CLOSE)).toBe('close');
  expect(inWords(CLOSE - 0.001)).toBe('not close');
});
