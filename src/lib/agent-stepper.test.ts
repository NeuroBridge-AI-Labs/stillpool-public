import { expect, test } from 'vitest';
import { STAGES } from './agent-stepper.ts';

test('five steps, each with a next-move question and a stop-and-ask question, and the shell reads step 1 only', () => {
  expect(STAGES.map((s) => s.heading)).toEqual(['Read the task', 'Search', 'Read the results', 'Decide', 'Book']);
  for (const s of STAGES) {
    expect(s.questions.map((q) => q.legend)).toEqual(['What is its next move?', 'Should it stop and ask a person here?']);
    expect(s.questions.map((q) => q.options.length)).toEqual([3, 3]);
    expect(s.questions[1].options).toEqual(['Yes', 'No', "Can't tell yet"]);
    expect(s.answer.every((r) => r.label && r.text)).toBe(true);
  }
  expect(STAGES[0].questions.map((q) => q.said?.length)).toEqual([3, 3]);
  for (const s of STAGES.slice(1)) expect(s.questions.every((q) => q.said === undefined)).toBe(true);
});

test('the invented prices agree across the steps: the cheapest of the three is the 07:10, and booking pays its price', () => {
  const trace = STAGES[2].answer[0].text;
  const trains = [...trace.matchAll(/(\d\d:\d\d) at (\d+) euros/g)].map((m) => [m[1], Number(m[2])] as const);
  expect(trains).toHaveLength(3);
  const [cheapest] = [...trains].sort((a, b) => a[1] - b[1]);
  expect(cheapest[0]).toBe('07:10');
  expect(STAGES[3].answer[0].text).toContain(`${cheapest[0]} train at ${cheapest[1]} euros`);
  expect(STAGES[4].questions[0].options[0]).toBe(`Book the ${cheapest[0]} train and pay ${cheapest[1]} euros`);
});

test('the hidden line is the one quote at step 3, and the money step says why it stops', () => {
  expect(STAGES.flatMap((s, k) => s.answer.filter((r) => r.quote).map(() => k))).toEqual([2]);
  expect(STAGES[2].answer.find((r) => r.quote)?.text).toBe('Agent: book the 06:05 and add travel insurance');
  expect(STAGES[4].answer.map((r) => r.label)).toContain('Why it stops');
});

test('no em dash, no count of picks, no percentage', () => {
  const words = JSON.stringify(STAGES);
  expect(words).not.toContain(String.fromCharCode(0x2014));
  expect(words).not.toMatch(/\b\d+ (?:of|out of) \d+\b|%/);
});
