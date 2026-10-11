import { describe, expect, it } from 'vitest';
import { compare, lines, mistakes, run, testSet, train, training, verdict, wrongIn, worse } from './sort-the-dataset.ts';

// The numbers are the lesson's pack (docs/packs/ethics/bias.md, I3 to I6 and the prototype run in section 4).
describe('the training examples', () => {
  it('are 20 ambers always, and 1 or 3 brills at each score', () => {
    expect(training(1).filter((e) => e.kind === 'amber')).toHaveLength(20);
    expect(training(1).filter((e) => e.kind === 'brill')).toHaveLength(10);
    expect(training(3).filter((e) => e.kind === 'brill')).toHaveLength(30);
  });
  it('test on 20 new ambers and 20 new brills, 2 at each score', () => {
    const t = testSet();
    expect(t.filter((e) => e.kind === 'amber')).toHaveLength(20);
    expect(t.filter((e) => e.kind === 'brill')).toHaveLength(20);
  });
});

describe('the mistakes at each cut-off match the prototype', () => {
  it('with 10 brill examples', () => expect(mistakes(training(1))).toEqual({ 1: 14, 2: 11, 3: 8, 4: 5, 5: 2, 6: 3, 7: 4, 8: 7, 9: 10, 10: 13, 11: 16 }));
  it('with 30 brill examples', () => expect(mistakes(training(3))).toEqual({ 1: 26, 2: 21, 3: 16, 4: 11, 5: 6, 6: 5, 7: 4, 8: 9, 9: 14, 10: 19, 11: 24 }));
  it('with 20 brill examples it ties at 5, 6 and 7, which is why that choice is not offered', () => {
    const m = mistakes(training(2));
    expect([m[5], m[6], m[7]]).toEqual([4, 4, 4]);
    expect(train(training(2))).toBe(5); // a tie takes the lowest
  });
});

describe('the results the lesson states', () => {
  it('choice A: cut-off 5, no amber wrong, 4 brills wrong at 5 and 6, 4 wrong in 40', () => {
    const r = run(1);
    expect(r.cutoff).toBe(5);
    expect(r.amber).toEqual({ wrong: 0, total: 20, scores: [] });
    expect(r.brill).toEqual({ wrong: 4, total: 20, scores: [5, 6] });
    expect(r.overall).toMatchObject({ wrong: 4, total: 40 });
    expect(worse(r)).toBe('brill');
  });
  it('choice B: cut-off 7, 4 ambers wrong at 5 and 6, no brill wrong, 4 wrong in 40', () => {
    const r = run(3);
    expect(r.cutoff).toBe(7);
    expect(r.amber).toEqual({ wrong: 4, total: 20, scores: [5, 6] });
    expect(r.brill).toEqual({ wrong: 0, total: 20, scores: [] });
    expect(r.overall).toMatchObject({ wrong: 4, total: 40 });
    expect(worse(r)).toBe('amber');
  });
  it('the overall number is the same both times, and who is wrong flips', () => expect(run(1).overall.wrong).toBe(run(3).overall.wrong));
  it('gives the same result every time', () => expect(run(1)).toEqual(run(1)));
});

describe('the words', () => {
  it('say "4 wrong in 20, about 1 in 5", never "of" or a percentage', () => {
    expect(wrongIn(run(1).brill)).toBe('4 wrong in 20, about 1 in 5');
    expect(wrongIn(run(1).overall)).toBe('4 wrong in 40, about 1 in 10');
    expect(wrongIn(run(1).amber)).toBe('0 wrong in 20');
    const all = [...lines(run(1)), ...lines(run(3))].join(' ');
    expect(all).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b/);
  });
  it('name which fruit were wrong and why', () => {
    expect(lines(run(1))).toContain('Brills it got wrong had scores 5 and 6: not ripe, sorted ripe.');
    expect(lines(run(3))).toContain('Ambers it got wrong had scores 5 and 6: ripe, sorted not ripe.');
  });
});

describe('what we say of a guess', () => {
  it('tells a right guess, a wrong guess and a tie in words', () => {
    expect(verdict('brill', run(1))).toBe('You said brills. It did get brills wrong more often.');
    expect(verdict('amber', run(1))).toBe('You said ambers. It got brills wrong more often.');
    expect(verdict('same', run(3))).toBe('You said about the same. It got ambers wrong more often.');
    expect(verdict('amber', run(3))).toBe('You said ambers. It did get ambers wrong more often.');
  });
  it('says the overall number did not change, and who was wrong did', () => {
    expect(compare(run(1), run(3))).toBe('The overall line is the same both times: 4 wrong in 40, about 1 in 10. The overall number did not change. Who was wrong did.');
  });
});
