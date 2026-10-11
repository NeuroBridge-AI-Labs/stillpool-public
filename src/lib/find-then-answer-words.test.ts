import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { rank } from './find-then-answer.ts';
import { load } from 'js-yaml';
import { ABOUT, firstMatch, snapshot } from './find-then-answer-words.ts';

const data = JSON.parse(readFileSync('data/interactive/glossary-vectors.json', 'utf8')) as { entries: { term: string; lesson: string; vector: number[] }[]; questions: { text: string; vector: number[] }[] };
const reading = (i: number) => {
  const q = data.questions[i].vector;
  return firstMatch(q, data.entries, ABOUT[i], rank(q, data.entries)[0]);
};

test('one thing asked about per question', () => {
  expect(ABOUT).toHaveLength(data.questions.length);
});

test('the first match is the entry asked about for six questions, and is not for temperature and fine-tuning', () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => reading(i).slice(0, 3))).toEqual(['Yes', 'No.', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'No.']);
});

test('temperature: the entry exists, further down the ranking, and is not close; fine-tuning has no entry', () => {
  expect(reading(1)).toMatch(/^No\. The first match is language model\. The entry for temperature is number \d+ in the full ranking: not close\.$/);
  expect(reading(7)).toMatch(/^No\. The snapshot of the glossary has no entry for fine-tuning\. The first match is [\w -]+: not close\.$/);
});

test('with the entry asked about placed first, the reading flips to yes, and with another placed first, to no', () => {
  const q = [1, 0];
  const entries = [{ term: 'a', lesson: 'l', vector: [1, 0] }, { term: 'b', lesson: 'l', vector: [0, 1] }];
  expect(firstMatch(q, entries, 'a', rank(q, entries)[0])).toBe('Yes. The first match is the entry for a.');
  expect(firstMatch(q, entries, 'b', rank(q, entries)[0])).toBe('No. The first match is a. The entry for b is number 2 in the full ranking: not close.');
});

const LESSON = 'content/going-deeper/answers-from-your-documents';

test('the counts the words name are the counts of the snapshot file', () => {
  const words = snapshot(data.entries);
  expect(words).toBe('159 entries from the first 25 lessons');
  const lesson = readFileSync(`${LESSON}/index.mdx`, 'utf8');
  expect(lesson).toContain(`It holds ${words}, as they stood on 9 October 2026`);
  expect(lesson.match(/\b\d+ entries from the first \d+ lessons/g)).toEqual([words]); // no second, different count
});

// The rule in the lesson: a quote is altered when a word or punctuation mark inside the quote marks is added, left out or
// changed. Ignored: the quote marks, spacing, a capital letter at the start, and a comma or full stop just inside the closing
// mark. Nothing else, so a quote that leaves out the passage's lesson name is altered.
test('counted over the sixteen recorded answers, the rule finds four altered quotes and four flagged answers', () => {
  const rec = JSON.parse(readFileSync('data/recorded/R-5.5.json', 'utf8')) as { variants: { label: string; maker: string; messages: { content: string }[]; runs: { reply?: string; replies?: string[] }[] }[] };
  const said = (load(readFileSync(`${LESSON}/recorded.yaml`, 'utf8')) as Record<string, { summary: string; marks: { variant: string; maker: string; shows: boolean }[] }>)['R-5.5'];
  const norm = (q: string) => q.replace(/\*/g, '').trim().replace(/[,.]$/, '');
  const altered = rec.variants.flatMap((v) => {
    const sent = v.messages[0].content.split('\n\nQuestion:')[0];
    const reply = (v.runs[0].replies ?? [v.runs[0].reply!])[0];
    return [...reply.replace(/\*/g, '').matchAll(/"([^"]+)"/g)].map((m) => norm(m[1])).filter((q) => ![q, q[0].toUpperCase() + q.slice(1), q[0].toLowerCase() + q.slice(1)].some((c) => sent.includes(c))).map(() => `${v.label}${v.maker}`);
  });
  expect(altered).toEqual(['Q1B', 'Q3B', 'Q4B', 'Q4B']);
  const flagged = [...new Set(said.marks.filter((m) => m.shows).map((m) => `${m.variant}${m.maker}`))];
  expect(flagged).toEqual(['Q1B', 'Q3B', 'Q4B', 'Q7B']);
  expect(said.summary).toContain('four quotes were altered and two statements went beyond the passages, in four answers in all');
  expect(said.summary).toContain('Twelve of the sixteen answers did. Four did not.');
});

test('question 4 names two terms, and either one first counts as a yes', () => {
  const q = [1, 0];
  const entries = [{ term: 'round', lesson: 'l', vector: [1, 0] }, { term: 'epoch', lesson: 'l', vector: [0, 1] }];
  expect(firstMatch(q, entries, ['round', 'epoch'], rank(q, entries)[0])).toBe('Yes. The first match is the entry for round.');
});
