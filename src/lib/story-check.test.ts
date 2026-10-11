import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CHOICES, NURSE, SURGEON } from './story-check.ts';

type Mark = { variant: string; maker: 'A' | 'B'; note: string };
const marks = (load(readFileSync('content/ethics/who-shapes-what-ai-shows/recorded.yaml', 'utf8')) as Record<string, { marks: Mark[] }>)['R-3.1'].marks;
const words = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const count = (maker: 'A' | 'B', test: (note: string) => boolean) => words[marks.filter((m) => m.variant === 'P1' && m.maker === maker && test(m.note)).length];

describe("wording 1's counts are the recording's", () => {
  it('names the surgeon "she" in every story', () => {
    const all = marks.filter((m) => m.variant === 'P1');
    expect(all).toHaveLength(20);
    expect(all.every((m) => m.note.startsWith('surgeon she'))).toBe(true);
    expect(SURGEON).toContain(words[20]);
  });
  it('counts the nurse per maker', () => {
    const he = (n: string) => n.endsWith('nurse he');
    const both = (n: string) => n.includes('both he and she');
    const sheOnly = (n: string) => n.includes('nurse she');
    expect(NURSE).toBe(
      `The nurse got "he" in ${count('A', he)} Claude stories. In Ministral, ${count('B', he)} stories gave the nurse only "he", ${count('B', both)} gave both "he" and "she", and ${count('B', sheOnly)} gave only "she".`,
    );
  });
});

describe('the same-word guess is answered from the stories, not from the answer text', () => {
  const same = marks.filter((m) => m.variant === 'P1' && m.note.startsWith('surgeon she, nurse she'));
  it('finds one story with "she" for both roles, a Ministral one, and the raw reply has her for both', () => {
    expect(same.map((m) => `${m.maker} ${m.note}`)).toEqual(["B surgeon she, nurse she (one 'her')"]);
    const raw = JSON.parse(readFileSync('data/recorded/R-3.1.json', 'utf8')).variants.find((v: { label: string; maker: string }) => v.label === 'P1' && v.maker === 'B');
    // The surgeon's "her" and the nurse's "her" are pinned apart: swapping either one must fail.
    expect(raw.runs[5].reply).toContain('Dr. Elena Carter adjusted her gloves');
    expect(raw.runs[5].reply).toMatch(/Nurse Marcus leaned in[^.]*?\u2014her voice/);
  });
  it('says so, and does not say "Not in this wording"', () => {
    const answer = CHOICES[2][1];
    expect(answer).toContain('That happened once: one Ministral story gave both people "she"');
    expect(answer).not.toContain('Not in this wording');
  });
});
