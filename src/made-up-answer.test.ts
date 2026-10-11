import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from 'vitest';
import { counted, type CheckRun } from './lib/made-up-answer.ts';
const LESSON = 'content/how-ai-works/why-they-make-things-up';
const rec = JSON.parse(readFileSync('data/recorded/R-1.6.json', 'utf8'));
const answers = (load(readFileSync(`${LESSON}/recorded.yaml`, 'utf8')) as Record<string, { answers: CheckRun[] }>)['R-1.6'].answers;
const run = (maker: 'A' | 'B', n: number, verdicts: string[], studies = verdicts.map((_, i) => i + 1)) => ({
  maker, run: n, lines: verdicts.map((verdict, i) => ({ line: i + 1, study: studies[i], kind: 'study' as const, verdict })),
});
test('the featured answer follows the fixed maker order and skips split studies', async () => {
  const { featured } = await import('./lib/made-up-answer.ts');
  const a = run('A', 1, ['checked', 'made-up-detail', 'checked']);
  const b = run('B', 1, ['made-up-study', 'made-up-detail', 'checked']);
  expect(featured([b, a])).toEqual(a);
  expect(featured([run('A', 1, ['made-up-study', 'checked'], [1, 1]), b])).toEqual(b);
  expect(featured([run('A', 1, ['checked']), run('B', 1, ['made-up-study', 'made-up-detail', 'made-up-study'])])).toEqual(run('B', 1, ['made-up-study', 'made-up-detail', 'made-up-study']));
});
test('the summary uses words, counts only confirmed wrong details, and never compares makers', async () => {
  const { summary } = await import('./lib/made-up-answer.ts');
  const runs = [run('A', 1, ['checked']), run('A', 2, ['checked']), run('A', 3, ['checked']), run('B', 1, ['made-up-study']), run('B', 2, ['made-up-detail']), run('B', 3, ['checked'])];
  expect(summary(runs, 'Claude Sonnet 5', 'Ministral 3 14B')).toEqual([
    'Three answers were recorded from each AI, six in all.',
    'From Claude Sonnet 5: no answer had at least one made-up detail.',
    'From Ministral 3 14B: one answer had at least one made-up detail.',
    'One answer named a study we could not find.',
  ]);
});

// Brief T6 and p6-15-review S3, S5: each check line is its verdict's fixed words, the values read from recorded.yaml.
test('check lines join every wrong detail and read the year from the record', async () => {
  const { checkText, verdictText } = await import('./lib/made-up-answer.ts');
  const wrong = { title: 'Laptop multitasking', authors: 'Faria Sana', year: '2013' };
  expect(checkText({ kind: 'study', study: 2, verdict: 'made-up-detail', wrong })).toBe('Checked: a study with a close title exists, but its title, its authors and its year do not match the record. The record\'s title is “Laptop multitasking”. Its authors are Faria Sana. Its year is 2013.');
  expect(checkText({ kind: 'study', study: 1, verdict: 'made-up-detail', wrong: { journal: 'Psychological Science' } })).toBe('Checked: this study exists, but its journal does not match the record. The record\'s journal is Psychological Science.');
  expect(checkText({ kind: 'other', verdict: 'made-up-detail', wrong: { year: '2013' } })).toBe('Checked: this line says the studies are from 2020 or later, but one named study came out in 2013.');
  expect(checkText({ kind: 'other', study: 2, verdict: 'made-up-detail', wrong: { year: '2013' } })).toBe('Checked: this line says Study 2 is from 2020 or later, but its record says 2013.');
  expect(verdictText({ kind: 'study', study: 2, verdict: 'made-up-detail', wrong })).toBe('Study 2 is close to a real study, but the title, authors and year differ.');
  expect(verdictText({ kind: 'study', study: 1, verdict: 'made-up-detail', wrong: { title: 'x' } })).toBe('Study 1 is real, but it has a made-up detail.');
  const searched = [{ where: 'Crossref', rule: 'cited title, normalized top 20', date: '2026-09-28', found: false }];
  expect(checkText({ kind: 'study', study: 3, verdict: 'made-up-study', searched })).toBe("We could not find this study. On 28 September 2026, we searched Crossref's top 20 results and the web for its exact title. The same searches found a real study.");
});
// T8: the lesson prose's count sentence, bound to the checks.
const COUNT = /made-up detail in (\d+) of its (\d+) runs\. [^.]*? had one in (\d+) of its (\d+) runs\./;
const countOkay = (mdx: string) => expect(COUNT.exec(mdx)?.slice(1).map(Number)).toEqual([counted(answers, 'A'), 10, counted(answers, 'B'), 10]);
test('T8 the count sentence equals the runs with a made-up detail or a study we could not find', () => {
  const mdx = readFileSync(`${LESSON}/index.mdx`, 'utf8');
  countOkay(mdx);
  expect(() => countOkay(mdx.replace('detail in 0 of its', 'detail in 1 of its'))).toThrow();
});
test('T5 recorded answer text exists only in the JSON', () => {
  const source = [`${LESSON}/index.mdx`, `${LESSON}/recorded.yaml`, 'src/components/MadeUpAnswer.astro', 'src/components/CheckedAnswer.astro'].map((f) => readFileSync(f, 'utf8')).join('\n');
  const copied = (text: string) => rec.variants.some((v: any) => v.runs.some((r: any) => text.includes(r.reply.slice(0, 40)) || r.reply.split(/\r?\n/).some((line: string) => line.length >= 20 && text.includes(line))));
  expect(copied(source)).toBe(false);
  expect(copied(source + rec.variants[0].runs[0].reply.slice(0, 40))).toBe(true);
});
