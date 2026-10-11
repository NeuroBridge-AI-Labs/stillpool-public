import { describe, expect, it } from 'vitest';
import { ANSWER_WH, ARITHMETIC, TRAINING, WATER } from './energy-and-water.ts';

// Each "about N to M" range is our arithmetic, so it must be what the sourced numbers divide to, to the rounding we say.
const near = (said: number, exact: number) => expect(Math.abs(said - exact) / exact).toBeLessThan(0.03);

describe('the stated ranges are the sourced numbers divided', () => {
  for (const [name, { wh, said }] of Object.entries(ARITHMETIC)) {
    it(`${name}: ${said[0]} to ${said[1]} answers`, () => {
      near(said[0], wh / ANSWER_WH.openai); // the least energy for the answer gives the most answers
      near(said[1], wh / ANSWER_WH.google);
      expect(said[0]).toBeLessThan(said[1]);
    });
  }
  it('a 500 millilitre bottle holds about 1,900 of Google\'s prompts and about 11 of Mistral\'s responses', () => {
    near(WATER.bottleOfGoogle, WATER.bottleMl / WATER.googleMl);
    near(WATER.bottleOfMistral, WATER.bottleMl / WATER.mistralMl);
  });
  it('BLOOM is about 41 US home-years', () => near(TRAINING.homeYears, TRAINING.bloomKwh / TRAINING.homeKwh));
  it('the three figures for one answer are in order and none is one number for AI', () => {
    expect(ANSWER_WH.google).toBeLessThan(ANSWER_WH.epoch);
    expect(ANSWER_WH.epoch).toBeLessThan(ANSWER_WH.openai);
  });
});
