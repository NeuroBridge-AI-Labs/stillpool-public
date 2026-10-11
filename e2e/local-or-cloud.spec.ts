// 5.7's "Local or cloud?" (stage I, static) on the site build: the shared case checks, and what is special to this one: all four
// trade-off rows show in every task, and a figure is stated only in a row that links its source.
import { CASES, OPTIONS } from '../src/lib/local-or-cloud.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

// The Epoch AI row says "combined score": the word is its measure of models, never the reader's, so only that word is let through.
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:correct|wrong answer|streak)\b|\b\d+ points\b/i;
const LESSON = '/learn/going-deeper/open-models-on-your-own-machine/';
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[0], OPTIONS[2], OPTIONS[1], OPTIONS[2], OPTIONS[0]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[3].text),
  score: SCORE,
};
caseChecks(c);

test('every task shows Privacy, Speed, Quality and Our call in order, and "The figures" links its source', async ({ page }) => {
  expect(CASES).toHaveLength(5);
  await page.goto(LESSON);
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < CASES.length; k++) {
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
  for (const [k, x] of CASES.entries()) {
    const answer = answerOf(page, k);
    const text = await answer.innerText();
    const at = ['Privacy', 'Speed', 'Quality', 'Our call'].map((l) => text.indexOf(l));
    expect(at.every((i, j) => i >= 0 && (!j || i > at[j - 1])), `task ${k + 1}`).toBe(true);
    const figures = x.answer.find((r) => r.label === 'The figures');
    if (!figures) {
      expect(text, `task ${k + 1} states a figure with no source`).not.toMatch(/\b\d+(?:\.\d+)? ?(?:GB|tokens|kWh|Wh)\b/);
      continue;
    }
    await expect(answer.getByRole('link', { name: /./ })).toHaveAttribute('href', figures.href!);
  }
});
