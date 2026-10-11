import { describe, expect, it } from 'vitest';
import { check, move, RULES, START } from './which-rule.ts';

describe('which-rule', () => {
  it('moves one rule one place, and leaves the end rules where they are', () => {
    expect(move([0, 1, 2, 3], 1, -1)).toEqual([1, 0, 2, 3]);
    expect(move([0, 1, 2, 3], 1, 1)).toEqual([0, 2, 1, 3]);
    expect(move([0, 1, 2, 3], 0, -1)).toEqual([0, 1, 2, 3]);
    expect(move([0, 1, 2, 3], 3, 1)).toEqual([0, 1, 2, 3]);
  });
  it('returns a new order and never changes the one it was given', () => {
    const order = [0, 1, 2, 3];
    expect(move(order, 0, 1)).not.toBe(order);
    expect(order).toEqual([0, 1, 2, 3]);
  });
  it('starts with no rule in its own place', () => {
    expect(START.some((id, place) => id === place)).toBe(false);
    expect([...START].sort()).toEqual([0, 1, 2, 3]);
  });
  it('says, for each rule in the lesson order, where the reader put it, and scores nothing', () => {
    const rows = check([3, 1, 0, 2]);
    expect(rows.map((r) => r.rule)).toEqual(RULES.map((r) => r.rule));
    expect(rows.map((r) => r.yours)).toEqual(['You put it third.', 'You put it here.', 'You put it fourth.', 'You put it first.']);
    expect(check([0, 1, 2, 3]).every((r) => r.yours === 'You put it here.')).toBe(true);
    expect(Object.keys(rows[0]).sort()).toEqual(['reason', 'rule', 'yours']);
  });
});
