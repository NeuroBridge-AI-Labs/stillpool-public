// 4.8's "Same text, your way" (stage II, R-4.8) on the fixture build: the shared checks for the recorded part, and what is
// special to this one: the five key points in bold in the original, the first question's copy shown at the reveal, "Show me:"
// swapping both tools' copy by keyboard, each copy's note, and the account of the four kinds the same whatever is picked.
import { ASK, COPIES, FACTS } from '../../src/lib/same-text-your-way.ts';
import { expect, type Page, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/using-ai-well/ai-for-access/';
const rec = fixture('R-4.8');
const r = (l: string, m: 'A' | 'B') => reply(rec, l, m, 1);
const picks = ['same-first|Plain words', 'same-kinds|All four', `same-missing|${FACTS[4].point}`];
const slots = (page: Page) => tryIt(page).locator('.runs-pair:has(.slot)');
const reveal3 = async (page: Page) => {
  for (const p of picks) await radio(page, p).check();
  await reveal(page).click();
};

p2Checks({ lesson: LESSON, n: 'R-4.8', picks, before: [], after: [r('plain words', 'A'), r('plain words', 'B')], said: 'You said all four.', score: /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak)\b|\b\d+ points\b/i });

test('the five key points are in bold in the original, in order, and listed under it', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page).locator('blockquote.sent strong')).toHaveText(FACTS.map((f) => f.span));
  await expect(tryIt(page).locator('ol li')).toHaveText(FACTS.map((f) => f.point));
});

test('the copy chosen first is shown from both tools at the reveal, and "Show me:" swaps both, by keyboard', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page).getByRole('radio', { name: 'Summary', exact: true })).toBeHidden(); // waits for the reveal
  await reveal3(page);
  await expect(tryIt(page).getByRole('radio', { name: 'Plain words', exact: true }).last()).toBeChecked();
  await expect(slots(page).getByText(r('plain words', 'A'), { exact: true })).toBeVisible();
  await expect(slots(page).getByText(r('plain words', 'B'), { exact: true })).toBeVisible();
  // the live region holds one short line, not the replies
  await expect(tryIt(page).locator('[data-status]')).toHaveAttribute('aria-live', 'polite');
  await expect(tryIt(page).locator('[data-status]')).toHaveText('Showing the plain words copy from both tools.');
  await expect(slots(page)).not.toHaveAttribute('aria-live', /.*/);
  const show = tryIt(page).locator('.show-me');
  await show.getByRole('radio', { name: 'Plain words' }).focus();
  await page.keyboard.press('ArrowDown'); // the next radio, Bullet points
  await expect(slots(page).getByText(r('bullet points', 'A'), { exact: true })).toBeVisible();
  await expect(slots(page).getByText(r('bullet points', 'B'), { exact: true })).toBeVisible();
  await expect(slots(page).getByText(r('plain words', 'A'), { exact: true })).toHaveCount(0);
  await expect(tryIt(page).locator('[data-status]')).toHaveText('Showing the bullet points copy from both tools.');
  await expect(slots(page).locator('article')).toHaveCount(2);
  await expect(slots(page).locator('article').first()).toContainText('What was lost: test fixture note bullet points A run 1.');
  await expect(slots(page).locator('article mark')).toHaveText('reply bullet points B'); // a changed word is marked, with its reason
  await expect(slots(page)).toContainText('Not true: Test fixture reason bullet points B');
  for (const c of COPIES) await expect(show.getByRole('radio', { name: c.name, exact: true })).toBeVisible();
});

test('the account of the four kinds is the same whatever was picked, and says nothing about right or wrong', async ({ page }) => {
  const kinds = ASK.find((q) => q.name === 'kinds')!;
  const rest = (a: string) => a.slice(a.indexOf('. ') + 2);
  for (const [text, after] of kinds.choices) {
    await page.goto(LESSON);
    await radio(page, picks[0]).check();
    await tryIt(page).getByRole('radio', { name: text, exact: true }).check();
    await radio(page, picks[2]).check();
    await reveal(page).click();
    await expect(tryIt(page).locator('.picked')).toContainText(after.slice(0, after.indexOf('. ') + 1));
    await expect(tryIt(page).locator('.feedback').nth(1)).toContainText(rest(after));
    await expect(tryIt(page).locator('.picked')).not.toContainText(/\b(right|wrong|correct|incorrect|well done|you got it)\b/i);
  }
});

test('as text the "Show me:" choice is gone and the notice is there', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  await expect(tryIt(page).locator('.show-me')).toBeHidden();
  await expect(tryIt(page)).toContainText('A neat copy can still lose or change a point.');
});
