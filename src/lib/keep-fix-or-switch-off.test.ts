import { describe, expect, it } from 'vitest';
import { CALLS, decide, flipLine, type Report, REPORT, TOLERANCES, totals } from './keep-fix-or-switch-off.ts';

// The calls and reasons are the writer's notes (C-evaluation.md section 3) for the invented report.
describe('the report in the lesson', () => {
  it('has 9 wrong in 200, 1 in group A and 8 in group B, none serious', () => {
    expect(totals(REPORT)).toEqual({ questions: 200, wrong: 9 });
    expect(REPORT.serious).toBe(0);
  });
  it.each([
    [50, CALLS.off, ['All 200 questions together had 9 wrong, which is over 1 wrong in 50.', 'Group B had 8 wrong in 100, which is also over 1 in 50.']],
    [20, CALLS.fix, ['All 200 questions together had 9 wrong, which is under 1 wrong in 20.', 'Group B had 8 wrong in 100, which is over 1 in 20, so one group does worse.', 'No serious wrong answer was found, so this is a fault to fix and test again, not a reason to switch off.']],
    [10, CALLS.keep, ['All 200 questions together had 9 wrong, which is under 1 wrong in 10.', 'Group B had 8 wrong in 100, which is under 1 in 10.', 'No serious wrong answer was found.']],
    [5, CALLS.keep, ['All 200 questions together had 9 wrong, which is under 1 wrong in 5.', 'Group B had 8 wrong in 100, which is under 1 in 5.', 'No serious wrong answer was found.']],
  ])('at 1 in %i the call is %s, with its reasons', (k, call, reasons) => expect(decide(REPORT, k)).toEqual({ call, reasons }));
  it('says where the call moves', () =>
    expect(flipLine(REPORT)).toBe(
      'The call moves from Switch off to Fix between about 1 in 50 and 1 in 20, because 9 wrong in 200 is under 1 in 20 but 8 wrong in 100 is not. It moves from Fix to Keep between 1 in 20 and 1 in 10, because group B is then under the rate. It does not move between 1 in 10 and 1 in 5.',
    ));
});

// Each threshold and one step each side, at every rate. Two groups of 100 questions; k = 50, 20, 10, 5.
const report = (a: number, b: number, serious = 0): Report => ({ ...REPORT, groups: REPORT.groups.map((g, i) => ({ ...g, wrong: [a, b][i] })), serious });
describe.each(TOLERANCES)('at 1 in %i', (k) => {
  const one = 100 / k; // a group at exactly the rate
  it('the total at the rate is kept, one more wrong is switched off', () => {
    expect(decide(report(one, one), k).call).toBe(CALLS.keep);
    expect(decide(report(one + 1, one), k).call).toBe(CALLS.off);
    expect(decide(report(one - 1, one), k).call).toBe(CALLS.keep);
  });
  it('a group at the rate is kept, one more wrong is fixed (the total stays under)', () => {
    expect(decide(report(0, one), k).call).toBe(CALLS.keep);
    expect(decide(report(0, one + 1), k).call).toBe(CALLS.fix);
    expect(decide(report(0, one - 1), k).call).toBe(CALLS.keep);
  });
  it('a serious wrong answer alone is fixed; with a group over it is switched off', () => {
    expect(decide(report(0, 0, 1), k).call).toBe(CALLS.fix);
    expect(decide(report(0, one + 1, 1), k).call).toBe(CALLS.off);
    expect(decide(report(0, one, 1), k).call).toBe(CALLS.fix);
  });
});

describe('words', () => {
  it('say exactly the rate when a count sits on it', () => expect(decide(report(2, 2), 50).reasons[0]).toContain('exactly 1 wrong in 50'));
  it('say a serious wrong answer was found', () => expect(decide(report(0, 0, 1), 20).reasons.at(-1)).toBe('A serious wrong answer was found, so fix it and test again.'));
});
