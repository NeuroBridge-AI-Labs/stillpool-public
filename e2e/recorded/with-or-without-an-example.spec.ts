// 2.4's "With or without an example" (stage I, R-2.4) on the fixture build: the shared checks, plus the matched quirk last.
import { expect, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/examples/';
const rec = fixture(4);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const PICKS = ['example-1|Request B, with two example cards.', 'example-2|Neither of them.', 'example-3|They will differ from run to run.'];

p2Checks({
  lesson: LESSON, n: 4, picks: PICKS,
  before: ['Request A has no words about the format. So these runs cannot tell an example from a description of the format.'],
  after: [r('A', 'A', 1), r('B', 'A', 2), r('A', 'B', 1), r('B', 'B', 1)],
});

test('both requests and the two example cards are in view before the prediction', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page).locator('blockquote.sent')).toHaveCount(2);
  await expect(tryIt(page).locator('blockquote.sent').last()).toContainText('Q: Test fixture question one?');
});

test('the shown runs pair a plain Claude run with request A, and the matched quirk comes last beside the two cards', async ({ page }) => {
  await page.goto(LESSON);
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
  const pairs = tryIt(page).locator('.runs-pair');
  await expect(pairs).toHaveCount(3);
  await expect(pairs.nth(0).getByText(r('A', 'A', 1), { exact: true })).toBeVisible();
  await expect(pairs.nth(0).getByText(r('B', 'A', 2), { exact: true })).toBeVisible();
  await expect(pairs.nth(1).getByText(r('A', 'B', 1), { exact: true })).toBeVisible();
  await expect(pairs.nth(1).getByText(r('B', 'B', 1), { exact: true })).toBeVisible();
  await expect(pairs.nth(2).locator('article')).toHaveCount(3);
  await expect(pairs.nth(2)).toContainText('Example card 2');
  await expect(pairs.nth(2).getByText(r('B', 'A', 1), { exact: true })).toBeVisible();
  await expect(tryIt(page).locator('.picked')).toContainText('you said the runs would differ.');
  await expect(tryIt(page).locator('.picked')).toContainText('you said neither would give plain lines.');
});
