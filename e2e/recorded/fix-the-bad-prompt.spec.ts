// 2.1's "Fix the bad prompt" (stage I, R-2.1) on the fixture build: the shared checks, plus the ladder's own.
import { expect, test } from '../guard.ts';
import { fixture, p2Checks, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/bad-and-good-prompts/';
const rec = fixture(1);
const PICKS = ['The email will be about an extension.', 'The email will name Dr Byrne and the illness.', 'The email will be about 100 words, with no tips.', 'The email will end on the offer to send the note.'];
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);

p2Checks({
  lesson: LESSON, n: 1, picks: PICKS,
  before: [r('A', 'A', 1), r('A', 'B', 1)],
  after: [r('step 1', 'A', 1), r('step 3', 'B', 1), r('B', 'A', 1)],
});

test('each step shows both makers, and "Show another run" cycles the three runs of prompt B', async ({ page }) => {
  await page.goto(LESSON);
  for (const name of PICKS) await tryIt(page).getByRole('radio', { name, exact: true }).check();
  await reveal(page).click();
  const steps = tryIt(page).locator('section:has(> blockquote)');
  await expect(steps).toHaveCount(4);
  for (const label of ['step 1', 'step 2', 'step 3']) for (const maker of ['A', 'B'] as const)
    await expect(steps.getByText(r(label, maker, 1), { exact: true })).toBeVisible();
  const b = steps.last();
  await expect(b.getByText(r('B', 'A', 1), { exact: true })).toBeVisible();
  await expect(b.getByText(r('B', 'A', 2), { exact: true })).toBeHidden();
  await b.getByRole('button', { name: 'Show another run' }).click();
  await expect(b.getByText(r('B', 'A', 2), { exact: true })).toBeVisible();
  await expect(b.getByText(r('B', 'B', 2), { exact: true })).toBeVisible();
  await b.getByRole('button', { name: 'Show another run' }).click();
  await b.getByRole('button', { name: 'Show another run' }).click();
  await expect(b.getByText(r('B', 'A', 1), { exact: true })).toBeVisible();
  await expect(steps.first().getByRole('button', { name: 'Show another run' })).toHaveCount(0);
});

test('a piece marked as not true is highlighted, with its reason, and the picks are said in words', async ({ page }) => {
  await page.goto(LESSON);
  for (const name of PICKS) await tryIt(page).getByRole('radio', { name, exact: true }).check();
  await reveal(page).click();
  const mark = tryIt(page).locator('.run mark').first();
  await expect(mark).toHaveText('Test fixture false claim');
  await expect(mark.locator('xpath=ancestor::article[1]')).toContainText('Not true: Test fixture reason.');
  await expect(tryIt(page).locator('.picked')).toContainText('Step 1: you said the email would be about an extension.');
  await expect(tryIt(page).locator('.picked')).toContainText('Prompt B: you said the email would end on the offer.');
});
