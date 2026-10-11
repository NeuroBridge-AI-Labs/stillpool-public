import { describe, expect, it } from 'vitest';
import { cardText, FIELDS, wasRun } from './skill-card.ts';

const RECORDED =
  "Procedure: meeting notes. Purpose: turn a transcript into notes a busy team can read in one minute. Steps: 1. List decisions. 2. List actions, each with an owner and a date. 3. List open questions. Rules: never invent a name or a date; if something is unclear, write 'unclear'. Format: three headed lists, nothing else.";
const STRONG = FIELDS.map(() => 'strong' as const);

describe('skill-card', () => {
  it('makes the recorded card, word for word, from four strong picks', () => {
    expect(cardText(STRONG)).toBe(RECORDED);
  });
  it('puts a weak wording in only the field it was picked for', () => {
    const card = cardText(['strong', 'strong', 'weak', 'strong']);
    expect(card).toContain('Rules: Be accurate and do a good job. Format:');
    expect(card).toContain('Purpose: turn a transcript');
    expect(card).not.toContain('never invent');
    expect(cardText(['weak', 'weak', 'weak', 'weak'])).toBe('Procedure: meeting notes. Purpose: help with meetings. Steps: Read it and write down what matters. Rules: Be accurate and do a good job. Format: Make it look nice.');
  });
  it('counts a card as run only when all four picks are strong', () => {
    expect(wasRun(STRONG)).toBe(true);
    for (let i = 0; i < 4; i++) expect(wasRun(STRONG.map((p, at) => (at === i ? 'weak' : p)))).toBe(false);
    expect(wasRun([])).toBe(false);
  });
  it('refuses a card with a missing or unknown pick', () => {
    expect(() => cardText(['strong'])).toThrow(/one strong or weak pick/);
    expect(() => cardText(['strong', 'strong', 'strong', 'bold' as never])).toThrow(/one strong or weak pick/);
  });
});
