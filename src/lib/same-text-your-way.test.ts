import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { recorded, recording } from '../lesson-schema.ts';
import { cut } from './p2-runs.ts';
import { ASK, COPIES, FACTS, ORIGINAL } from './same-text-your-way.ts';

const rec = recording.parse(JSON.parse(readFileSync('data/recorded/R-4.8.json', 'utf8')));
const said = recorded.parse(load(readFileSync('content/using-ai-well/ai-for-access/recorded.yaml', 'utf8')))['R-4.8'];

describe('the paragraph and the key points', () => {
  it('is exactly what was sent, in all eight requests', () => {
    expect(rec.variants).toHaveLength(8);
    for (const v of rec.variants) expect(v.messages![0].content, `${v.label} ${v.maker}`).toContain(`\n\n${ORIGINAL}`);
  });
  it('has every key point in the paragraph once, in bold, in order', () => {
    const parts = cut(ORIGINAL, FACTS.map((f) => f.span));
    expect(parts.filter(([, bold]) => bold).map(([t]) => t)).toEqual(FACTS.map((f) => f.span));
    expect(parts.map(([t]) => t).join('')).toBe(ORIGINAL);
  });
});

describe('the four kinds of copy', () => {
  it('are the recording\'s labels, each from both tools, once, with a "what was lost" or "nothing was lost" note', () => {
    expect(COPIES.map((c) => c.label)).toEqual([...new Set(rec.variants.map((v) => v.label))]);
    for (const c of COPIES) for (const maker of ['A', 'B']) {
      expect(rec.variants.find((v) => v.label === c.label && v.maker === maker)!.runs).toHaveLength(1);
      expect(said.marks!.find((m) => m.variant === c.label && m.maker === maker)!.note, `${c.label} ${maker}`).toMatch(/^(What was lost|What was changed|Nothing was lost)/);
    }
  });
});

describe('what is said back', () => {
  it('has a first sentence and then what happened, for every choice of every question', () => {
    for (const q of ASK) for (const [text, after] of q.choices) expect(after.indexOf('. '), `${q.name}: ${text}`).toBeGreaterThan(0);
  });
  it('gives the same account of the four kinds whatever is picked, and never a count with digits', () => {
    const kinds = ASK.find((q) => q.name === 'kinds')!.choices.map(([, a]) => a.split('. ').slice(1).join('. '));
    expect(new Set(kinds).size).toBe(1);
    for (const q of ASK) for (const [, a] of q.choices) expect(a).not.toMatch(/\d+ (of|out of) \d+|%|\b(right|wrong|correct|incorrect|well done|you got it)\b/i);
  });
  it('has the missing-point account where the recorded notes agree: the textbook credit, dropped by three copies', () => {
    const dropped = said.marks!.filter((m) => /two claims are the textbook's/.test(m.note)).map((m) => `${m.variant} ${m.maker}`);
    expect(dropped.sort()).toEqual(['outline B', 'summary A', 'summary B']);
    expect(ASK.find((q) => q.name === 'missing')!.choices[4][1]).toContain('Three copies dropped it');
  });
});
