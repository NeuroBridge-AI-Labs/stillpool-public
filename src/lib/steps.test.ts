import { expect, test } from 'vitest';
import { answer, current, finished, initial, ready } from './steps.ts';

test('a stage with two questions enables Show only when both have a pick', () => {
  expect(ready([])).toBe(false);
  expect(ready([true, false])).toBe(false);
  expect(ready([false, true])).toBe(false);
  expect(ready([true, true])).toBe(true);
  expect(ready([true])).toBe(true);
});

test('a stage reveals on its own Show and opens the next; the rest wait', () => {
  let s = initial(5);
  expect(s).toEqual(['open', 'open', 'hidden', 'hidden', 'hidden']);
  expect(current(s)).toBe(0);
  s = answer(s, 0);
  expect(s).toEqual(['answered', 'open', 'hidden', 'hidden', 'hidden']);
  s = answer(s, 1);
  expect(s).toEqual(['answered', 'answered', 'open', 'hidden', 'hidden']);
  expect(current(s)).toBe(2);
  expect(finished(s)).toBe(false);
});

test('answering the last stage finishes, and starting again returns exactly the load state', () => {
  const load = initial(5);
  const done = [0, 1, 2, 3, 4].reduce(answer, load);
  expect(done).toEqual(Array(5).fill('answered'));
  expect(finished(done)).toBe(true);
  expect(current(done)).toBe(-1);
  expect(initial(5)).toEqual(load);
  expect(initial(5)).not.toBe(load); // a fresh array each time: nothing is shared or mutated
  expect(load).toEqual(['open', 'open', 'hidden', 'hidden', 'hidden']);
});
