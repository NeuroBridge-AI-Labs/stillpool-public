import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { recorded, recording } from '../lesson-schema.ts';
import { detectorCases, ORDER, textsOf } from './will-the-detector-flag-it.ts';
import { flagged, predictability, rating, seenLine, trigrams } from './pretend-detector.ts';

const book = trigrams(readFileSync('data/training/dubliners.txt', 'utf8'));
const rec = recording.parse(JSON.parse(readFileSync('data/recorded/R-4.3.json', 'utf8')));
const said = recorded.parse(load(readFileSync('content/using-ai-well/ai-detectors/recorded.yaml', 'utf8')))['R-4.3'];

describe('the engine, on a tiny book', () => {
  const tiny = trigrams('a b c d');
  it('counts a piece seen when its run of three is in the book, and not otherwise', () => {
    expect(predictability('a b c', tiny)).toEqual({ seen: 1, total: 1 });
    expect(predictability('a b x', tiny)).toEqual({ seen: 0, total: 1 });
    expect(predictability('a b c d x', tiny)).toEqual({ seen: 2, total: 3 });
  });
  it('does not rate the first two pieces, and says so for a text too short', () => {
    expect(predictability('a b', tiny)).toEqual({ seen: 0, total: 0 });
    expect(rating({ seen: 0, total: 0 })).toBe('too short to rate');
  });
});

describe('the bands, on both sides of each line', () => {
  it.each([
    [[50, 100], 'very predictable, flagged'],
    [[49, 100], 'fairly predictable, flagged'],
    [[25, 100], 'fairly predictable, flagged'],
    [[24, 100], 'not very predictable, not flagged'],
    [[0, 100], 'not very predictable, not flagged'],
  ])('%j is %s', ([seen, total], band) => expect(rating({ seen, total })).toBe(band));
  it('says counts in words, singular and plural, never as a percentage', () => {
    expect(seenLine({ seen: 1, total: 101 })).toBe('1 piece in 101 was seen');
    expect(seenLine({ seen: 3, total: 93 })).toBe('3 pieces in 93 were seen');
  });
});

describe('the eight texts, against the real book', () => {
  // Pack ai-detectors, section 4: each text's count, worked out by a separate script.
  const known: Record<string, [number, number]> = {
    synge1: [12, 112], joyce: [72, 72], potter: [21, 95], synge2: [5, 75], streetA: [3, 93], streetB: [9, 106], teaA: [1, 101], teaB: [1, 96],
  };
  const texts = textsOf(rec);
  it.each(Object.entries(known))('%s counts %j', (id, [seen, total]) => {
    expect(predictability(texts.find((t) => t.id === id)!.text, book)).toEqual({ seen, total });
  });
  it('flags the Joyce passage, which is in the book, and none of the other seven', () => {
    expect(texts.filter((t) => flagged(predictability(t.text, book))).map((t) => t.id)).toEqual(['joyce']);
  });
  it('shows six texts in the fixed order, with three rows each', () => {
    const cases = detectorCases(rec, book);
    expect(cases).toHaveLength(6);
    expect(ORDER).toHaveLength(6);
    for (const c of cases) expect(c.answer.map((r) => r.label)).toEqual(['The pretend detector said', 'Who wrote it', 'What this shows']);
    expect(cases[1].answer[0].text).toBe('Rated very predictable, flagged. 72 pieces in 72 were seen in the book.');
    expect(cases[0].answer[0].text).toBe('Rated not very predictable, not flagged. 12 pieces in 112 were seen in the book.');
  });
  it('agrees with the numbers the lesson prints for the four recorded texts', () => {
    for (const m of said.marks!) {
      const id = m.variant + m.maker;
      expect(m.note, id).toContain(`${seenLine(predictability(texts.find((t) => t.id === id)!.text, book))} in the book`);
    }
  });
});
