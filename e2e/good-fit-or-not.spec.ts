// 4.9's "Good fit or not?" (stage I, static) on the site build: the shared case checks, and what is special to this one: six
// situations, four labels said to be ours, asking a person said to be no failure, an evidence row that is plain text, and a
// pick that is never compared with our reading.
import { CASES, INTRO, OPTIONS } from '../src/lib/good-fit-or-not.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const LESSON = '/learn/using-ai-well/when-not-to-use-ai/';
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[3], OPTIONS[2], OPTIONS[1], OPTIONS[0], OPTIONS[1], OPTIONS[2]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);

test('six situations, four labels that are ours, and asking a person is no failure', async ({ page }) => {
  expect(CASES).toHaveLength(6);
  expect(OPTIONS).toHaveLength(4);
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText('The four choices are our labels, not a rule from anyone else.');
  await expect(tryIt(page)).toContainText('Asking a person is a good choice. It is never a failure.');
  expect(INTRO.join(' ')).not.toMatch(/\bfailure\b.*\bperson\b.*\bfailure\b/);
});

test('a pick that differs from our reading is shown beside it, never marked', async ({ page }) => {
  await page.goto(LESSON);
  await choose(page, 0, OPTIONS[0], c); // ours is Do it yourself
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toHaveText(`You picked: ${OPTIONS[0]}`);
  await expect(answerOf(page, 0)).toContainText('Our reading: Do it yourself');
  await expect(answerOf(page, 0)).not.toContainText(/\b(correct|incorrect|well done|you got it|mistake)\b/i);
});

test('the evidence rows and the person to call are plain text: the only links in the activity are none', async ({ page }) => {
  await page.goto(LESSON);
  for (const x of CASES) for (const r of x.answer) expect(r.href, r.label).toBeUndefined();
  expect(await tryIt(page).getByRole('link').count()).toBe(0);
  expect(CASES.filter((x) => x.answer.some((r) => r.label === 'The evidence')).length).toBeGreaterThan(0);
});

test('no percentage appears in the activity: study figures are said in words, and the lesson text holds the exact ones', () => {
  for (const x of CASES) {
    expect(x.scene).not.toContain('%');
    for (const r of x.answer) expect(r.text, r.label).not.toContain('%');
  }
});
