// 4.4's "Read the small print" (stage I, static) on the site build: the shared case checks, then what is special to it: the
// invented small print is printed in the lesson as six numbered clauses, each scene names the clauses to read, and the quoted clause names its number.
import { CASES, OPTIONS } from '../src/lib/read-the-small-print.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from './cases.ts';
import { expect, test } from './guard.ts';

const c: Cases = {
  lesson: '/learn/using-ai-well/privacy-habits/',
  picks: [OPTIONS[0], OPTIONS[2], OPTIONS[1]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[1].text),
};
caseChecks(c);

test('the small print is printed once in the lesson as six clauses; each scene says which to read; each asks its own question', async ({ page }) => {
  await page.goto(c.lesson);
  await expect(page.locator('main ol', { hasText: 'Who we are' }).locator('li')).toHaveCount(6);
  await expect(page.locator('main ol li').filter({ hasText: 'Clause 3, what you send' })).toHaveCount(1);
  await expect(page.getByText('This is invented text, not a real company')).toHaveCount(1);
  expect(CASES.map((x) => x.scene)).toEqual(['Read clauses 3 and 4 above.', 'Read all six clauses above.', 'Read clauses 5 and 6 above.']);
  await expect(tryIt(page).getByText('Invented terms for a made-up tool called Lumen')).toHaveCount(0);
  await expect(tryIt(page).getByText(CASES[0].question!)).toBeVisible();
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  await expect(tryIt(page).getByText(CASES[1].question!)).toBeVisible();
});

test('the quoted clause is the highlight: it opens with its clause number or says no clause mentions it', async ({ page }) => {
  await page.goto(c.lesson);
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  await expect(answerOf(page, 0).locator('blockquote.sent')).toHaveText(CASES[0].answer[0].text);
  expect(CASES[0].answer[0].text).toMatch(/^Clause \d/);
  await choose(page, 1, c.picks[1], c);
  await showFor(page, 1).click();
  await expect(answerOf(page, 1)).toContainText('The clause: None.');
});
