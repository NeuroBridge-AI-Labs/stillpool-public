// Lesson 1.10's build test (its brief, Interactive): T1 to T7 on the committed data, with the known-bad fixtures.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compare, control, feedData, feedSimulator, mostly, ORDINALS, share, topicsLine } from './feed-simulator.ts';

const raw = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const DATA = feedData.parse(raw('data/interactive/feed-simulator.json'));
const RUN = feedSimulator(DATA);
const bad = (name: string) => raw(`fixtures/bad/feed-simulator/${name}.json`);
const topicOf = (id: string) => id.replace(/-\d+$/, '');
const count = (ids: string[], topic: string) => ids.filter((id) => topicOf(id) === topic).length;

test('T1 the data: five places, ten opens, five topics and shapes, short titles with no digit, newest lists each item once', () => {
  expect([DATA.places, DATA.opens, DATA.topics.length]).toEqual([5, 10, 5]);
  for (const titles of Object.values(DATA.items)) for (const t of titles) expect(t.split(' ').length).toBeGreaterThanOrEqual(2);
  expect(feedData.safeParse(bad('twice-newest')).success).toBe(false);
  expect(feedData.safeParse({ ...DATA, topics: DATA.topics.map((t) => ({ ...t, shape: 'circle' })) }).success).toBe(false);
  expect(feedData.safeParse({ ...DATA, items: { ...DATA.items, music: ['Song 2', 'Two words', 'Three short words'] } }).success).toBe(false);
});
test('T2 the places rule on known weights, and the places always add up to five', () => {
  const cases = { 1: [1, 1, 1, 1, 1], 2: [1, 1, 1, 1, 1], 3: [2, 1, 1, 1, 0], 5: [3, 1, 1, 0, 0], 6: [3, 1, 1, 0, 0], 9: [4, 1, 0, 0, 0], 11: [4, 1, 0, 0, 0] };
  for (const [a, want] of Object.entries(cases)) expect(share([Number(a), 1, 1, 1, 1], 5), a).toEqual(want);
  for (let a = 1; a < 30; a++) expect(share([a, 3, 2, 1, 1], 5).reduce((s, x) => s + x)).toBe(5);
});
test('T3 the path: every open is Animals; its places never fall and end at three or more; the topics never rise and end fewer', () => {
  const ids = RUN.states.map((s) => s.ids);
  expect(ids.slice(0, -1).map((s) => topicOf(s[0])), 'ten opens').toEqual(Array(10).fill('animals'));
  const animals = ids.map((s) => count(s, 'animals'));
  expect(animals.every((n, i) => !i || n >= animals[i - 1]) && animals.at(-1)! > animals[0] && animals.at(-1)! >= 3).toBe(true);
  const topics = RUN.states.map((s) => s.topics.length);
  expect(topics.every((n, i) => !i || n <= topics[i - 1]) && topics.at(-1)! < topics[0]).toBe(true);
});
test('T4 enough items: too few unseen items throws; the committed data does not', () => {
  expect(() => feedSimulator(feedData.parse(bad('too-few')))).toThrow(/animals has fewer unseen items than places/);
  expect(() => feedSimulator(DATA)).not.toThrow();
});
test('T5 the controls: each widens; Start again gives one place each; Newest first ignores counts; Show less keeps the top', () => {
  const [tenth, [none, less, again, newest]] = [RUN.states[10], RUN.controls];
  expect(none.ids).toEqual(tenth.ids);
  for (const c of [less, again, newest]) expect(c.topics.length, c.label).toBeGreaterThan(tenth.topics.length);
  expect(DATA.topics.map((t) => count(again.ids, t.id))).toEqual([1, 1, 1, 1, 1]);
  const opened = new Set(RUN.states.slice(0, 10).map((s) => s.ids[0]));
  const first = DATA.newest.filter((id) => !opened.has(id)).slice(0, 5);
  expect(newest.ids).toEqual(first);
  expect(control(DATA, 'newest', [3, 0, 2, 0, 1], opened)).toEqual(first);
  expect(count(less.ids, 'animals')).toBeLessThan(count(tenth.ids, 'animals'));
  expect(DATA.topics.every((t) => count(less.ids, t.id) <= count(less.ids, 'animals'))).toBe(true);
});
test('T6 the words: the comparison, the ordinals, the topics line in data order and the "mostly one topic" line', () => {
  expect(compare(['a', 'b'], ['a', 'b'])).toBe('The same topics as before.');
  expect(compare(['a'], ['a', 'b'])).toBe('Fewer topics than before.');
  expect(compare(['a', 'b', 'c'], ['a', 'b'], 'after the tenth open')).toBe('More topics than after the tenth open.');
  expect(ORDINALS).toEqual(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']);
  expect(topicsLine(DATA, ['music', 'animals', 'space'])).toBe('Topics in the feed: Animals, Space, Music.');
  expect(RUN.states[3].words).toEqual(['After the third open.', 'The same topics as before.', 'Topics in the feed: Animals, Cooking, Space, Football.']);
  expect(mostly(DATA, RUN.states[10].ids)).toBe('The feed ended up with mostly one topic: Animals.');
  expect(mostly(DATA, RUN.states[3].ids)).toBeUndefined();
});
test('T7 nothing typed in: the schema refuses a results key, and two runs give the same', () => {
  expect(feedData.safeParse(bad('extra-key')).success).toBe(false);
  expect(feedSimulator(feedData.parse(raw('data/interactive/feed-simulator.json')))).toEqual(RUN);
});
