// 3.5's "Incident casebook" (stage I, static) on the site build: the shared case checks, and what is special to this one:
// four incidents, our four labels said to be ours, every sentence also in the lesson text, each record linked and dated
// with the links the lesson's sources list, and nothing quoted from a record.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { CASES, INTRO, OPTIONS } from '../src/lib/incident-casebook.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, SCORE, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const LESSON = '/learn/ethics/harm-and-misuse/';
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[0], OPTIONS[3], OPTIONS[1], OPTIONS[2]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);

const mdx = readFileSync('content/ethics/harm-and-misuse/index.mdx', 'utf8');
const sentences = (t: string) => t.split(/(?<=\.) /);

test('four incidents, four labels, and the labels are said to be ours', async ({ page }) => {
  expect(CASES).toHaveLength(4);
  expect(OPTIONS).toEqual(['Data', 'Design', 'Use', 'Oversight']);
  expect(CASES.map((x) => x.answer[0].text)).toEqual(['Use', 'Oversight', 'Data', 'Design']);
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText('The four labels are ours. No court or inquiry uses them.');
  await expect(tryIt(page)).toContainText('Several records show more than one place');
  for (const k of [0, 1, 2, 3]) expect(INTRO.join(' ')).not.toContain(CASES[k].answer[0].text + ' is');
});

test("every sentence the casebook says is in the lesson's own text, which wins over the notes", () => {
  const lesson = mdx.replace(/\*\*/g, '').toLowerCase().replace(/\s+/g, ' ');
  for (const x of CASES) {
    for (const row of x.answer.filter((r) => !r.href && r.label !== 'Where it went wrong (our label)' && r.label !== 'What we read'))
      for (const s of sentences(row.text)) expect(lesson, s).toContain(s.toLowerCase());
    for (const s of sentences(x.scene)) expect(lesson, s).toContain(s.toLowerCase());
  }
});

test("each record is linked, dated, and one of the lesson's own sources", async ({ page }) => {
  const sources = (load(/^---\n([\s\S]*?)\n---/.exec(mdx)![1]) as { sources: { url?: string }[] }).sources.map((s) => s.url);
  await page.goto(LESSON);
  await choose(page, 0, OPTIONS[0], c);
  await reveal(page).click();
  for (let k = 1; k < CASES.length; k++) {
    await choose(page, k, OPTIONS[0], c);
    await showFor(page, k).click();
  }
  for (const [k, x] of CASES.entries()) {
    const links = await answerOf(page, k).locator('a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(links).toEqual(x.answer.filter((r) => r.href).map((r) => r.href));
    for (const l of links) expect(sources).toContain(l);
    expect(x.answer.find((r) => r.label === 'The record')!.text).toMatch(/\b(?:19|20)\d\d\b/);
  }
  await expect(tryIt(page).locator('blockquote')).toHaveCount(0);
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
});

// t2 C2 and the harm review H3, H8, H9: Robodebt is stated as the judgment (Prygodicz v Commonwealth (No 2) [2021] FCA 634, Murphy J,
// 11 June 2021) states it. The expected words are the reviewer's quotations of those paragraphs, not read from the lesson.
test('Robodebt is stated as the judgment states it: a review period, not yearly, and actual knowledge of unlawfulness', () => {
  const robodebt = CASES[3];
  const shown = [robodebt.scene, ...robodebt.answer.map((r) => r.text)].join(' ');
  expect(shown).not.toMatch(/\byearly\b|\bannual/i);
  expect(shown).toContain('for a review period');
  expect(shown).toContain('"do not earn a stable or constant income"');
  expect(shown).toContain('The Commonwealth agreed to pay $112 million, which includes legal costs.');
  expect(shown).not.toContain('linked, not read');
  expect(mdx).not.toMatch(/actually knew the method was unreliable/);
  expect(mdx).toContain('"There is little in the materials to indicate that the evidence rises to that level."');
  expect(mdx).toContain('"they actually knew that the operation of the Robodebt system was unlawful"');
  expect(mdx).toContain('to the responsible Minister'); // paragraph 5 has "to the responsible Minister", which the summary dropped
  expect(mdx).not.toMatch(/did not read the judgment|not the judgment itself/i);
});
