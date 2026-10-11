// 5.6's "Which tool for the job?" (stage I, static) on the site build: the shared case checks, and what is special to this one:
// four tools offered in every job, and every reading with its five rows in order.
import { CASES, OPTIONS } from '../src/lib/which-tool-for-the-job.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

// Job 6 says a test score can fall (OpenAI's example) and job 5 that training needs correct examples: words about a system and its
// data, never about the reader. So the shared 'no score' regex lets those two words through and keeps the rest.
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:wrong answer|streak)\b|\b\d+ points\b/i;
const LESSON = '/learn/going-deeper/prompt-rag-or-fine-tune/';
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[0], OPTIONS[1], OPTIONS[3], OPTIONS[2], OPTIONS[1], OPTIONS[3]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
  score: SCORE,
};
caseChecks(c);

test('every job offers the same four tools, and every reading has its five rows in order', async ({ page }) => {
  expect(CASES).toHaveLength(6);
  await page.goto(LESSON);
  await choose(page, 0, c.picks[0], c);
  expect(await tryIt(page).locator('[data-step]').first().getByRole('radio').evaluateAll((rs) => rs.map((r) => r.closest('label')?.textContent?.trim()))).toEqual(OPTIONS);
  await reveal(page).click();
  for (let k = 1; k < CASES.length; k++) {
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
  for (const [k, x] of CASES.entries()) {
    const text = await answerOf(page, k).innerText();
    const at = ['Our reading', 'Why', 'What it changes', 'Cost and data', 'How we would test it'].map((l) => text.indexOf(l));
    expect(at.every((i, j) => i >= 0 && (!j || i > at[j - 1])), `job ${k + 1}`).toBe(true);
    expect(text).toContain(x.answer[0].text);
  }
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
});
