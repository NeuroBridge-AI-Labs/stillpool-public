// 4.5's "Stop and check" (stage I, static) on the site build: the shared case checks, then what is special to it: every reading
// starts with "Can't tell yet", whatever is picked, and the outcome is named as invented.
import { CASES, OPTIONS } from '../src/lib/stop-and-check.ts';
import { answerAll, answerOf, type Cases, caseChecks, choose, reveal, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const c: Cases = {
  lesson: '/learn/using-ai-well/real-or-fake/',
  picks: [OPTIONS[0], OPTIONS[1], OPTIONS[2]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
  score: /%|\b\d+ (?:of|out of) \d+\b|\b(?:correct|wrong answer|streak)\b|\b\d+ points\b/i, // SCORE minus the word "score" and bare "points": the intro says "There is no score."
};
caseChecks(c);

test('"can\'t tell yet" comes first in every reading, even when the pick is Real, and the outcome is called invented', async ({ page }) => {
  for (const x of CASES) {
    expect(x.answer[0].text).toMatch(/^Can't tell yet, until /);
    expect(x.answer[2].label).toBe('What you did next (invented)');
  }
  await page.goto(c.lesson);
  await choose(page, 0, OPTIONS[0], c);
  await reveal(page).click();
  await expect(answerOf(page, 0)).toContainText(`Our reading: ${CASES[0].answer[0].text}`);
  await expect(answerOf(page, 0)).toContainText('What you did next (invented):');
  expect(await tryIt(page).innerText()).not.toMatch(/\b(?:right|wrong|correct|incorrect|well done|you got it)\b/i);
});

test('the activity shows no percentage; the studies figures stay in the lesson text', async ({ page }) => {
  await page.goto(c.lesson);
  await answerAll(page, c);
  expect((await tryIt(page).innerText()).match(/\d+(?:\.\d+)?%/g)).toBeNull();
});
