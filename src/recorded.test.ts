// The schema every data/recorded/<id>.json meets (T5.10, inventory section E), tried on a fixture that is no recording.
import { globSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { recorded, recording } from './lesson-schema.ts';
import { spread } from './lib/next-word.ts';

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const FIXTURE = read('fixtures/recorded/R-1.1.json');
const without = (key: string) => Object.fromEntries(Object.entries(FIXTURE).filter(([k]) => k !== key));

test('1 the fixture parses', () => {
  expect(recording.safeParse(FIXTURE).success).toBe(true);
});

test('2 a file without the model, the date or the settings fails, and so does one with a summary', () => {
  for (const key of ['model', 'date', 'settings']) expect(recording.safeParse(without(key)).success, key).toBe(false);
  // p6 D4: people's words live in the lesson's recorded.yaml, never beside the model's output.
  expect(recording.safeParse({ ...FIXTURE, summary: 'Written by a person.' }).success, 'a summary').toBe(false);
  expect(recording.safeParse({ ...FIXTURE, settings: {} }).success, 'no setting at all').toBe(false);
  expect(recording.safeParse({ ...FIXTURE, date: 'last week' }).success, 'a date that is not a date').toBe(false);
});

// P6.11 (p6 D4): a variant's own model and settings, one variant, and a run's searches, citations and calls.
test('2b the widened shape parses, and stays strict', () => {
  const run = { reply: 'Test', searches: ['q'], citations: [{ url: 'u', title: null, cited_text: 'c' }], calls: [{ at: '2026-10-01T10:32:00.000Z', request: { max_tokens: 1 }, error: { status: 529, category: 'http_error' } }] };
  const one = { ...FIXTURE, id: 'R-1.6', variants: [{ model: { ...FIXTURE.model, card: { default_model_temperature: null } }, settings: { max_tokens: 4096 }, runs: [run] }] };
  expect(recording.safeParse(one).success).toBe(true);
  expect(recording.safeParse({ ...one, variants: [] }).success, 'no variant').toBe(false);
  expect(recording.safeParse({ ...one, variants: [{ runs: [{ ...run, thinking: 'x' }] }] }).success, 'an unknown run field').toBe(false);
  expect(recording.safeParse({ ...one, variants: [{ runs: [{ ...run, citations: [{ url: 'u', title: 't' }] }] }] }).success, 'a citation without its words').toBe(false);
});

test('R-1.1 still requires two instructed variants', () => {
  expect(recording.safeParse({ ...FIXTURE, variants: FIXTURE.variants.slice(0, 1) }).success, 'one variant').toBe(false);
  expect(recording.safeParse({ ...FIXTURE, variants: FIXTURE.variants.map(({ instruction: _, ...variant }: { instruction: string }) => variant) }).success, 'no instructions').toBe(false);
});

test('R-1.6 checks require a record or a search for every checked line', () => {
  const checks = { 'R-1.6': { summary: 'by rule', checked: '2026-09-28', by: 'Reviewer', answers: [{ maker: 'A', run: 1, lines: [{ line: 1, study: 1, kind: 'study', result: 'found', verdict: 'checked', doi: '10.1177/0956797614524581', resolves: true }] }] } };
  expect(recorded.safeParse(checks).success).toBe(true);
  expect(recorded.safeParse({ 'R-1.6': { ...checks['R-1.6'], answers: [{ maker: 'A', run: 1, lines: [{ line: 1, kind: 'other', verdict: 'could-not-check' }] }] } }).success).toBe(false);
});

test('3 every real file in data/recorded/ parses, is named by its id, and keeps every piece', () => {
  // ponytail: none exists until Emanuel's key records R-1.1, so today this passes on an empty list.
  for (const file of globSync('data/recorded/*.json')) {
    const rec = recording.parse(read(file));
    expect(rec.id, file).toBe(file.slice('data/recorded/'.length, -5));
    // R-1.1's recorder always keeps each reply's chances, and 1.4 needs them (p5-pr11-review NICE 2); no other set has any.
    if (rec.id === 'R-1.1') expect(rec.variants.every((v) => v.runs.every((r) => r.pieces?.length)), `${file}: a run without its pieces`).toBe(true);
  }
});

// T8 (1.4 brief, the R-1.1 part): run 1 of the warm reply joins back to the stored reply. Its pieces hold the reply's
// text up to its emoji, which Scaleway stored as pieces with empty text, then one </s> (the R-1.1 data PR).
const t8 = (reply: string, pieces: { text: string }[]) => {
  expect(pieces.at(-1)?.text, 'the last piece').toBe('</s>');
  const joined = pieces.slice(0, -1).map((p) => p.text).join('');
  expect(reply.startsWith(joined), 'the pieces are the reply, in order').toBe(true);
  const rest = reply.slice(joined.length);
  expect(rest === '' || (/^\s?\p{Extended_Pictographic}+$/u.test(rest) && pieces.some((p) => p.text === '')), `what the empty pieces stand for: ${rest}`).toBe(true);
};
const WARM = recording.parse(read('data/recorded/R-1.1.json')).variants.find((v) => /warm/i.test(v.instruction ?? ''))?.runs[0];

test('T8 the warm reply, run 1, joins back from its pieces, its emoji as empty pieces and a last </s>', () => {
  t8(WARM?.reply ?? '', WARM?.pieces ?? []);
});

test('T8 known-bad: a piece changed, or a lost </s>, fails', () => {
  const pieces = WARM?.pieces ?? [];
  expect(() => t8(WARM?.reply ?? '', pieces.map((p, i) => (i === 3 ? { text: ' am' } : p)))).toThrow();
  expect(() => t8(WARM?.reply ?? '', pieces.slice(0, -1))).toThrow();
});

test('T8 the summary rule: 6 in 10 at 50 in 100 or more is high, 4 in 10 is lower, 5 in 10 is half', () => {
  const at = (high: number) => [...Array(high).fill(0.5), ...Array(10 - high).fill(0.49)];
  expect([6, 4, 5].map((n) => spread(at(n)))).toEqual([
    'Most pieces had a high chance: 50 in 100 or more.',
    'Most pieces had a lower chance: under 50 in 100.',
    'About half the pieces had a chance of 50 in 100 or more.',
  ]);
});
