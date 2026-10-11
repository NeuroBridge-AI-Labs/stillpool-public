// 2.6's "Draft, change, check" (stage I, R-2.6) on the fixture build: the shared checks, plus a conversation read turn
// by turn, "Show another run" cycling recorded runs, and the true answer with its source on screen.
import { expect, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/iterate-and-check/';
const rec = fixture(6);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const PICKS = ['draft-plan|It will name the lecture clash and use early slots.', 'draft-again|No, the plans will differ.', 'draft-S1|No, it will still give a false answer.', 'draft-S2|No, it will change its answer.'];
const open = async (page: import('../guard.ts').Page) => {
  await page.goto(LESSON);
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
};

p2Checks({
  lesson: LESSON, n: 6, picks: PICKS,
  before: ['Test fixture sent turns message 3'],
  after: [r('turns', 'A', 1), r('S1', 'B', 1), r('S2', 'A', 1)],
});

test('a run is a conversation: each message with the reply to it, in order', async ({ page }) => {
  await open(page);
  const card = tryIt(page).locator('.runs-pair').first().locator('article:visible').first();
  const said = await card.locator('.sent span, .reply').allInnerTexts();
  expect(said).toEqual([1, 2, 3].flatMap((t) => [`Test fixture sent turns message ${t}`, `Test fixture reply turns A run 1 turn ${t}`]));
});

test('"Show another run" cycles the three recorded runs of both models together, and comes back round', async ({ page }) => {
  await open(page);
  const pair = tryIt(page).locator('.runs-pair').first();
  const again = pair.getByRole('button', { name: 'Show another run' });
  for (const n of [2, 3, 1]) {
    await again.click();
    await expect(pair.getByText(r('turns', 'A', n), { exact: true })).toBeVisible();
    await expect(pair.getByText(r('turns', 'B', n), { exact: true })).toBeVisible();
    await expect(pair.locator('article:visible')).toHaveCount(2);
  }
  await again.focus();
  await page.keyboard.press('Enter');
  await expect(pair.getByText(r('turns', 'A', 2), { exact: true })).toBeVisible();
});

test('the fact questions show the true answer with its source, then the flipped maker first', async ({ page }) => {
  await open(page);
  const s1 = tryIt(page).locator('section:has(> .true-answer)').first();
  await expect(s1.locator('.true-answer').first()).toContainText('True answer: 174 members.');
  await expect(s1.getByRole('link', { name: 'Oireachtas, Members, TDs page (opens in a new tab)' })).toHaveAttribute('href', 'https://www.oireachtas.ie/en/members/tds/');
  await expect(s1.locator('article:visible').first()).toContainText('Test fixture model B');
  await expect(s1.locator('mark')).toHaveText('Test fixture false claim');
  await expect(tryIt(page).locator('.picked')).toContainText('you said it would still give a false answer.');
});
