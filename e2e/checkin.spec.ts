// The check-in (plan T6.4, D6; spec 3.3, R4 P16): every option explains itself at once in a polite live region,
// retries never run out, and no score, count or percentage of the learner is ever shown. Every published lesson is tested.
import { pages } from '../checks/serve.ts';
import { expect, test } from './guard.ts';

const lessons = pages('dist').filter((route) => route.startsWith('/learn/'));

// What the rule bans: a score, "x of y", a progress percentage, points. Not every digit: a dated source or a figure it
// reports ("55% of the citations") is lesson content, not a score of the learner.
const SCORE = /\b\d+ (?:of|out of) \d+\b|\d ?% ?(?:complete|done|finished|mastered|correct|right)\b|\b(?:progress|complete|done|score|scored|correct)\W{0,3}\d+ ?%|\byour score\b|\bscore:|\b(?:\d+ )?(?:correct answers|points)\b/i;

test('the score ban catches a planted score line and lets a dated source figure pass', () => {
  for (const line of ['You got 3 of 4 right.', 'Score: 3', 'You scored 75%.', '75% complete', 'You have 3 points.', 'Correct answers: 2.'])
    expect(line).toMatch(SCORE);
  for (const line of ['Checked on 3 October 2026.', 'More than half (55%) of the citations do not exist.', 'About 1 in 3.'])
    expect(line).not.toMatch(SCORE);
});

for (const lesson of lessons) {
  test(`${lesson}: a wrong and then a right answer each put their explanation in the live region at once`, async ({ page }) => {
    await page.goto(lesson);
    for (const question of await page.locator('.question').all()) {
      const live = question.locator('[aria-live="polite"]');
      for (const option of [question.locator('details:not([data-right])').first(), question.locator('details[data-right]')]) {
        await option.locator('summary').click();
        await expect(live).toHaveText((await option.locator('.why').textContent()) ?? 'missing');
      }
    }
  });

  test(`${lesson}: every option opens twice, with no limit`, async ({ page }) => {
    await page.goto(lesson);
    const options = page.locator('.question details');
    expect(await options.count()).toBeGreaterThan(1);
    for (let round = 0; round < 2; round++)
      for (const option of await options.all()) {
        await option.locator('summary').click();
        await expect(option).toHaveAttribute('open');
      }
  });

  test(`${lesson}: the feedback and status areas show no score, count or percentage`, async ({ page }) => {
    await page.goto(lesson);
    for (const option of await page.locator('.question details').all()) {
      await option.locator('summary').click();
      const said = await page.locator('.question [aria-live]').allTextContents();
      for (const text of said) expect(text).not.toMatch(SCORE);
    }
  });
}
