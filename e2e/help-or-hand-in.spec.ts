// 4.2's "Help or hand-in?" (stage I, static) on the site build: the shared case checks, then what is special to it: eight uses,
// four options, a "What to write" line only on the two "fine if you declare it" cases, and the pick is never compared with our reading.
import { CASES, OPTIONS } from '../src/lib/help-or-hand-in.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const c: Cases = {
  lesson: '/learn/using-ai-well/study-honestly-with-ai/',
  picks: [OPTIONS[0], OPTIONS[1], OPTIONS[2], OPTIONS[3], OPTIONS[1], OPTIONS[0], OPTIONS[2], OPTIONS[3]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);

test('eight uses, four options each, and a line to write only where the reading is "fine if you declare it"', async ({ page }) => {
  expect(CASES).toHaveLength(8);
  expect(OPTIONS).toHaveLength(4);
  await page.goto(c.lesson);
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < 8; k++) {
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
  const writes = CASES.map((x) => x.answer.some((r) => r.label === 'What to write'));
  expect(writes.filter(Boolean)).toHaveLength(2);
  for (const [k, w] of writes.entries()) {
    await expect(answerOf(page, k).getByText('What to write:')).toHaveCount(w ? 1 : 0);
    if (w) expect(CASES[k].answer[0].text).toMatch(/declare/i);
  }
});

test('our reading is the same whatever is picked, and nothing says right or wrong', async ({ page }) => {
  await page.goto(c.lesson);
  await choose(page, 0, OPTIONS[2], c);
  await reveal(page).click();
  await expect(answerOf(page, 0)).toContainText(`Our reading: ${CASES[0].answer[0].text}`);
  expect(await tryIt(page).innerText()).not.toMatch(/\b(?:right|wrong|correct|incorrect|well done|you got it)\b/i);
});
