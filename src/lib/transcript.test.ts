import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { turns } from './transcript.ts';

const said = (label: string) => JSON.parse(readFileSync('data/recorded/R-2.7.json', 'utf8')).variants.find((v: { label: string; maker: string }) => v.label === label && v.maker === 'A').messages[0].content.split('\n\n').slice(1).join('\n\n');

describe('turns', () => {
  it('numbers speakers by first appearance and keeps a role for every later line', () => {
    const t = turns('Priya (chair): Hello.\nJonah: Hi.\nPriya: Next.');
    expect(t.map((x) => [x.name, x.speaker, x.role])).toEqual([['Priya', 1, 'chair'], ['Jonah', 2, undefined], ['Priya', 1, 'chair']]);
    expect(t.map((x) => x.words)).toEqual(['Hello.', 'Hi.', 'Next.']);
  });
  it('gives no turns to a text that is not made of speaker lines', () => {
    expect(turns('Test fixture transcript 1')).toEqual([]);
    expect(turns('Priya: Hello.\nAnd a line with no speaker')).toEqual([]);
  });
  it('reads both recorded transcripts line for line, with at most five speakers', () => {
    for (const n of [1, 2]) {
      const text = said(`T${n} A`);
      const t = turns(text);
      expect(t.length, `transcript ${n}`).toBe(text.trim().split('\n').length);
      expect(Math.max(...t.map((x) => x.speaker))).toBeLessThanOrEqual(5);
    }
  });
});
