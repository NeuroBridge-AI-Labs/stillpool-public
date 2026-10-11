import { expect, test } from 'vitest';
import { PARTS, SAMPLES, check, fails, html, verdict } from './skill-file-checker';

const GOOD = SAMPLES[2].text;
const statusOf = (text: string, part: (typeof PARTS)[number]) => check(text).find((f) => f.part === part)!.status;
// Each rule: the known-good file passes it, and one edit that breaks only that rule fails it.
const swap = (from: string | RegExp, to: string) => GOOD.replace(from, to);

test('the three samples: A fails five parts, B fails only its description, C passes', () => {
  const bad = SAMPLES.map((s) => check(s.text).filter((f) => f.status !== 'present').map((f) => f.part));
  expect(bad).toEqual([['Name', 'Description', 'Steps', 'Rules', 'Examples'], ['Description'], []]);
  expect(SAMPLES.map((s) => verdict(check(s.text)))).toEqual(['This file fails.', 'This file fails.', 'This file passes.']);
  expect(check(SAMPLES[0].text).map((f) => f.part)).toEqual([...PARTS]);
});

test('file A prints the writer\'s notes word for word', () => {
  expect(check(SAMPLES[0].text).map((f) => f.note)).toEqual([
    'The name should use only lowercase letters, numbers and single hyphens.',
    'The description line has fewer than eight words and does not use the word "when".',
    'It has fewer than two numbered lines.',
    'An always or never line gives no reason. Add "because" or "so that" and say why.',
    'It has no Example heading, and no Input line with an Output line.',
    'It points to no other files, and a short file needs none.',
  ]);
});

test('name: missing, not lowercase-hyphen, then fine', () => {
  expect(statusOf(swap(/^name:.*\n/m, ''), 'Name')).toBe('missing');
  expect(statusOf(swap('name: source-check', 'name: Source Check'), 'Name')).toBe('vague');
  expect(statusOf(swap('name: source-check', 'name: source--check'), 'Name')).toBe('vague');
  expect(statusOf(GOOD, 'Name')).toBe('present');
});

test('description: missing, short, no when, then fine', () => {
  expect(statusOf(swap(/^description:.*\n/m, ''), 'Description')).toBe('missing');
  const short = swap(/^description:.*$/m, 'description: Use this when asked.');
  expect(statusOf(short, 'Description')).toBe('vague');
  expect(check(short)[1].note).toBe('The description line has fewer than eight words.');
  expect(statusOf(swap(/^description:.*$/m, 'description: Use this when a writer asks.'), 'Description')).toBe('vague'); // six words
  expect(statusOf(swap(/^description:.*$/m, 'description: Use this when a writer asks for it.'), 'Description')).toBe('present'); // eight words
  expect(statusOf(swap(/^description:.*$/m, 'description: Checks the sources in an article draft for the writer.'), 'Description')).toBe('vague');
  expect(statusOf(GOOD, 'Description')).toBe('present');
});

test('description: "Use this" alone is not a when (ten words, no condition)', () => {
  const noWhen = swap(/^description:.*$/m, 'description: Use this skill to check every source and quotation.');
  expect(statusOf(noWhen, 'Description')).toBe('vague');
  expect(check(noWhen)[1].note).toBe('The description line does not use the word "when".');
});

test('description: only the description line is read, so a description on later lines is not seen', () => {
  const folded = swap(/^description:.*$/m, 'description: >\n  Checks the sources in an article draft. Use this when a writer asks whether their links are right.');
  expect(statusOf(folded, 'Description')).toBe('vague');
  expect(check(folded)[1].note).toBe('The description line has fewer than eight words and does not use the word "when".');
});

test('steps: one numbered line is missing, two are present, "1)" counts', () => {
  expect(statusOf(swap(/^[23]\. .*\n/gm, ''), 'Steps')).toBe('missing');
  expect(statusOf(swap(/^(\d)\./gm, '$1)'), 'Steps')).toBe('present');
});

test('rules: none is missing, one without a reason is vague, "so that" counts', () => {
  expect(statusOf(swap(/^- (Never|Always).*\n/gm, ''), 'Rules')).toBe('missing');
  expect(statusOf(swap(', because only the writer knows the meaning', ''), 'Rules')).toBe('vague');
  expect(statusOf(swap('because only the writer knows the meaning', 'so that nobody is misquoted'), 'Rules')).toBe('present');
});

test('examples: a heading, or an Input and an Output line, else missing', () => {
  const noHeading = swap('## Example\n', '');
  expect(statusOf(noHeading, 'Examples')).toBe('present'); // Input and Output remain
  expect(statusOf(swap(/^Output:.*$/m, ''), 'Examples')).toBe('present'); // the heading remains
  expect(statusOf(noHeading.replace(/^Output:.*$/m, ''), 'Examples')).toBe('missing');
  expect(statusOf(noHeading.replace(/^Input:.*\n/m, ''), 'Examples')).toBe('missing');
});

test('reference files: none needs none, a pointer needs a when or if, the name line is ignored', () => {
  const none = swap(/^Read references.*$/m, '');
  expect(check(none)[5].note).toBe('It points to no other files, and a short file needs none.');
  expect(statusOf(swap('when the draft uses footnotes', 'for footnotes'), 'Reference files')).toBe('vague');
  expect(statusOf(swap('name: source-check', 'name: notes.md'), 'Reference files')).toBe(statusOf(GOOD, 'Reference files'));
  expect(statusOf(GOOD, 'Reference files')).toBe('present');
});

test('fails: any part not present fails the file', () => {
  expect(fails(check(GOOD))).toBe(false);
  expect(fails(check(swap('name: source-check', 'name: Source')))).toBe(true);
});

test('html: one term and one definition per part, in order, and no text from the file is put in it', () => {
  const out = html(check('<img src=x>'));
  expect(out.match(/<dt>/g)).toHaveLength(6);
  expect(out).not.toContain('<img');
});
