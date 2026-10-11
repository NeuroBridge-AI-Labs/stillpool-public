import { expect, test } from 'vitest';
import { type Lesson, suggest } from './lesson-suggestions.ts';

const lesson = (title: string): Lesson => ({ id: title, title, url: `/learn/${title}/` });
const lessons = ['What AI is and is not', 'Tokens', 'Iterate and check', 'A skill is a written procedure', 'Où est Zoë', 'Images and sound'].map(lesson);
const titles = (query: string, limit?: number) => suggest(query, lessons, limit).map((l) => l.title);

test('a word start matches any word of a title, so "it" and "ite" find Iterate and check', () => {
  expect(titles('it')).toEqual(['Iterate and check']);
  expect(titles('ite')).toEqual(['Iterate and check']);
});
test('the middle of a word does not match', () => expect(titles('erate')).toEqual([]));
test('several words match a run of title words in order', () => {
  expect(titles('written proc')).toEqual(['A skill is a written procedure']);
  expect(titles('proc written')).toEqual([]);
});
test('case, accents and spare spaces do not matter, and empty input suggests nothing', () => {
  expect(titles('  ZOE ')).toEqual(['Où est Zoë']);
  expect(titles('ou')).toEqual(['Où est Zoë']);
  expect(titles('   ')).toEqual([]);
});
test('a title that starts with the text comes before one that only has a word that does, then the limit applies', () => {
  expect(titles('a')).toEqual(['A skill is a written procedure', 'What AI is and is not', 'Iterate and check', 'Images and sound']);
  expect(titles('a', 2)).toHaveLength(2);
});
