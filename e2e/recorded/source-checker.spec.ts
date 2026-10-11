// 4.1's "Source checker" (stage I, R-4.1) on the fixture build: the shared case checks, then what is special to it: no
// citation row is a link, the four options include "Can't tell yet", and the recorded part waits for the last answer.
import { CASES, OPTIONS } from '../../src/lib/source-checker.ts';
import { afterChecks } from '../after-cases.ts';
import { type Cases, caseChecks, choose, reveal, tryIt } from '../cases.ts';
import { expect, test } from '../guard.ts';

const c: Cases = {
  lesson: '/learn/using-ai-well/check-it-before-you-use-it/',
  picks: [OPTIONS[0], OPTIONS[1], OPTIONS[2], OPTIONS[3]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);
afterChecks(c, 'R-4.1', ['The same question, five answers from each AI']);

test('four citations, four options, and no row is a link to the source', async ({ page }) => {
  expect(CASES).toHaveLength(4);
  expect(OPTIONS).toEqual(['Real and relevant', 'Real but unrelated', 'Not there', "Can't tell yet"]);
  await page.goto(c.lesson);
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  await expect(tryIt(page).locator('[data-case] a')).toHaveCount(0);
  await expect(tryIt(page)).toContainText('The links are shown as text on purpose.');
});
