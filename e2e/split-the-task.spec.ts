// 4.7's "Split the task" (stage I, static) on the site build: the shared case checks, and what is special to this one: five
// steps of one invented job, our four labels, the person who sends keeps that step, and the framework link is the only link.
import { CASES, OPTIONS } from '../src/lib/split-the-task.ts';
import { after } from './after-cases.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const LESSON = '/learn/using-ai-well/delegating-at-work/';
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[1], OPTIONS[2], OPTIONS[0], OPTIONS[3], OPTIONS[0]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);

test('five steps, four choices, and the pick is never compared with our split', async ({ page }) => {
  expect(CASES).toHaveLength(5);
  expect(OPTIONS).toHaveLength(4);
  await page.goto(LESSON);
  await choose(page, 0, OPTIONS[3], c); // a pick that differs from ours
  await reveal(page).click();
  await expect(answerOf(page, 0)).toContainText('Our split: Let AI help');
  await expect(tryIt(page).locator('.picked')).toHaveText(`You picked: ${OPTIONS[3]}`);
  await expect(answerOf(page, 0)).not.toContainText(/\b(correct|incorrect|well done|you got it)\b/i);
});

test('the steps that name people and that send are kept by a person, and the framework link is the only link', async ({ page }) => {
  await page.goto(LESSON);
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < 5; k++) {
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
  await expect(answerOf(page, 2)).toContainText('Our split: Do it yourself');
  await expect(answerOf(page, 4)).toContainText('Our split: Do it yourself');
  await expect(answerOf(page, 4).getByRole('link')).toHaveAttribute('href', 'https://aifluencyframework.org/');
  expect(await tryIt(page).getByRole('link').count()).toBe(1);
});

test('our whole split waits for the last answer, so it gives no later answer away', async ({ page }) => {
  await page.goto(LESSON);
  await expect(after(page)).toBeHidden();
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < 5; k++) {
    await expect(after(page)).toBeHidden();
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
  await expect(after(page)).toContainText('Our whole split: collect the updates');
});
