// Stored progress (plan T7.3, D7): an 8-line guard, restore as a union, and a badge only once every step is done.
import { beforeEach, expect, test, vi } from 'vitest';
import { EMPTY, fromStorage, progress, recordStep, restore } from './store.ts';

beforeEach(() => progress.set(EMPTY));

test('9 a stored value that fails the guard loads as empty', () => {
  const good = { v: 1, finished: ['a/b'], badges: [], steps: ['a/b#checkin-1'] };
  expect(fromStorage(JSON.stringify(good))).toEqual(good);
  for (const bad of ['{', 'null', '[]', JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, finished: [1] }), JSON.stringify({ v: 1 }),
    JSON.stringify({ ...good, badges: 'a/b' }), JSON.stringify({ ...good, steps: [1] })])
    expect(fromStorage(bad), bad).toEqual(EMPTY);
});

test('10 restore is a union and removes nothing', () => {
  progress.set({ v: 1, finished: ['a/one', 'a/two'], badges: ['a/one'], steps: ['a/one#checkin-1'] });
  restore({ finished: ['a/two', 'a/three'], badges: [] });
  expect(progress.get()).toEqual({ v: 1, finished: ['a/one', 'a/two', 'a/three'], badges: ['a/one'], steps: ['a/one#checkin-1'] });
});

test('11 a badge is added only when every earnedBy step is done', () => {
  const earnedBy = ['pick', 'checkin-2'];
  recordStep('a/one', 'checkin-2', earnedBy);
  expect(progress.get().badges).toEqual([]);
  recordStep('a/one', 'checkin-1', earnedBy);
  expect(progress.get().badges).toEqual([]);
  recordStep('a/one', 'pick', earnedBy);
  expect(progress.get().badges).toEqual(['a/one']);
});

// pr7-review NICE 1: a full storage is reported, so the page never says "back" when nothing was kept.
test('12 restore says whether it kept anything', () => {
  expect(restore({ finished: ['a/one'], badges: [] })).toBe(true);
  vi.spyOn(progress, 'set').mockImplementationOnce(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(restore({ finished: ['a/two'], badges: [] })).toBe(false);
  expect(progress.get().finished).toEqual(['a/one']);
});
