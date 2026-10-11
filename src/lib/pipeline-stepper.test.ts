import { expect, test } from 'vitest';
import { loadPipeline, STAGES } from './pipeline-stepper.ts';
import { marksOf, variantOf } from './p2-runs.ts';

// The stage words say what the recording shows ("began with Dublin in all three runs, none stopped by itself"). The
// recording wins, so these read the real file.
test('the recording is what stage 1 and stage 4 say it is', () => {
  const { rec } = loadPipeline();
  const base = variantOf(rec, 'BASE', 'A').runs;
  const tuned = variantOf(rec, 'TUNED', 'B').runs;
  expect(base).toHaveLength(3);
  expect(tuned).toHaveLength(3);
  for (const r of base) expect(r.reply.trimStart().startsWith('Dublin') && r.finish_reason === 'length').toBe(true);
  for (const r of tuned) expect(r.reply.startsWith('The capital of Ireland is Dublin.') && r.finish_reason === 'stop').toBe(true);
});

// The false statements in the base replies were found by reading each reply against a source; the loader only checks
// that a mark's falseText occurs, so this lists the ones known to be false and fails if one loses its mark.
test('every run has a mark, and each known false statement is marked with a reason', () => {
  const { rec, said } = loadPipeline();
  for (const [label, maker] of [['BASE', 'A'], ['TUNED', 'B']] as const)
    for (let n = 1; n <= 3; n++) expect(marksOf(said, label, maker, n).length).toBeGreaterThan(0);
  const known: [number, string][] = [
    [1, "it's not the capital of the Republic of Ireland"],
    [1, "It's about the size of the state of Washington"],
    [1, 'with a population of about 4.5 million'],
    [2, 'The River Slaney is the second longest river in Ireland.'],
    [2, 'The River Boyne is the third longest river in Ireland.'],
  ];
  for (const [n, text] of known) {
    expect(variantOf(rec, 'BASE', 'A').runs[n - 1].reply).toContain(text);
    expect(marksOf(said, 'BASE', 'A', n).find((m) => m.falseText === text)?.reason).toBeTruthy();
  }
});

test('five stages with one question each, the same three options, and the shell reads stage 1 only', () => {
  expect(STAGES.map((s) => s.heading)).toEqual(['Pretraining', 'Instruction tuning', 'Learning from preferences', 'Safety tuning', 'Updated later']);
  for (const s of STAGES) expect(s.questions).toHaveLength(1);
  expect(STAGES[0].questions[0].said).toHaveLength(3);
  for (const s of STAGES.slice(1)) expect(s.questions[0].said).toBeUndefined();
  const words = JSON.stringify(STAGES);
  expect(words).not.toContain(String.fromCharCode(0x2014));
  expect(words).not.toMatch(/\b\d+ (?:of|out of) \d+\b|%/);
});
