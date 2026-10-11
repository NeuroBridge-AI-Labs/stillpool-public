// Lesson 1.2's build test (its brief, Interactive): C1 to C5 on the committed data, and the known-bad data that must fail
// C1. Every result comes from the function; the data file holds inputs only.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { sortMessages, sortData } from './sort-messages.ts';

const read = (file: string) => sortData.parse(JSON.parse(readFileSync(file, 'utf8')));
const DATA = read('data/interactive/sort-the-messages.json');
const sorted = sortMessages(DATA);
// C1: junk that the rule catches and the model does not, so learning never looks as if it always wins.
const c1 = (s: typeof sorted) => s.some((m) => m.junk && m.rule && !m.model);

test('C1 the model misses a junk message the rule catches', () => {
  expect(c1(sorted)).toBe(true);
});

test('C2 the model catches a junk message the rule lets through', () => {
  expect(sorted.some((m) => m.junk && m.model && !m.rule)).toBe(true);
});

test('C3 the rule catches a message we marked not junk', () => {
  expect(sorted.some((m) => !m.junk && m.rule)).toBe(true);
});

test('C4 none of the five messages is one of the examples', () => {
  const seen = new Set(DATA.examples.map((e) => e.text.trim().toLowerCase()));
  expect(DATA.messages.filter((m) => seen.has(m.text.trim().toLowerCase()))).toEqual([]);
});

test('C5 nothing is typed in by hand: the data refuses a result, and the page gets the function run on the file', () => {
  expect(sortData.safeParse({ ...DATA, results: [] }).success, 'a results key').toBe(false);
  expect(sortData.safeParse({ ...DATA, messages: [{ ...DATA.messages[0], model: true }, ...DATA.messages.slice(1)] }).success, 'a typed-in group').toBe(false);
  expect(sortMessages(read('data/interactive/sort-the-messages.json'))).toEqual(sorted);
  expect(sorted.map((m) => m.text)).toEqual(DATA.messages.map((m) => m.text));
});

test('the known-bad data, message 2 made "Free cash prize, click the link to claim it now", fails C1', () => {
  expect(c1(sortMessages(read('fixtures/bad/sort-messages/message-2.json')))).toBe(false);
});

// M6.3.1 survived C1 to C5: on the lesson's data every group is the same without smoothing. Here it is not: "class" is in
// no junk example, and only add-one smoothing keeps that from ruling junk out.
test('add-one smoothing: a word missing from one group does not rule that group out', () => {
  const examples = [{ text: 'win prize', junk: true }, { text: 'win prize now', junk: true }, { text: 'class notes', junk: false }];
  const messages = ['win prize class', 'class notes', 'win', 'notes', 'prize'].map((text) => ({ text, junk: true }));
  expect(sortMessages({ rule: 'free', examples, messages }).map((m) => m.model)).toEqual([true, false, true, false, true]);
});
