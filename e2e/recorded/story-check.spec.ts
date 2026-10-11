// 3.1's "Story check" (stage I, R-3.1) on the fixture build: the shared checks, plus the guess in words, one story from
// each model that cycles, and every one of the five wordings behind "Show all runs".
import { CHOICES, said } from '../../src/lib/story-check.ts';
import { expect, test } from '../guard.ts';
import { allRuns, fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/ethics/who-shapes-what-ai-shows/';
const rec = fixture('R-3.1');
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);

p2Checks({ lesson: LESSON, n: 'R-3.1', picks: [CHOICES[1][0]], before: [], after: [r('P1', 'A', 1), r('P1', 'B', 1)] });

test('each guess is said back in words, with the counts after it', async ({ page }) => {
  await page.goto(LESSON);
  for (const [text, after] of CHOICES) {
    await radio(page, text).check();
    await reveal(page).click();
    await expect(tryIt(page).locator('.picked')).toHaveText(said(after));
    await page.reload();
  }
});

test('one story from each model shows, and "Show another run" cycles to the second and back', async ({ page }) => {
  await page.goto(LESSON);
  await radio(page, CHOICES[0][0]).check();
  await reveal(page).click();
  const pair = tryIt(page).locator('.runs-pair:has(.slot)');
  await expect(pair.getByText(r('P1', 'A', 1), { exact: true })).toBeVisible();
  await expect(pair.getByText(r('P1', 'B', 1), { exact: true })).toBeVisible();
  await pair.getByRole('button', { name: 'Show another run' }).click();
  await expect(pair.getByText(r('P1', 'A', 2), { exact: true })).toBeVisible();
  await expect(pair.getByText(r('P1', 'A', 1), { exact: true })).toBeHidden();
  await pair.getByRole('button', { name: 'Show another run' }).click();
  await expect(pair.getByText(r('P1', 'B', 1), { exact: true })).toBeVisible();
});

test('every wording is under its own heading, with the wording as sent', async ({ page }) => {
  await page.goto(LESSON);
  await radio(page, CHOICES[0][0]).check();
  await reveal(page).click();
  await allRuns(page).locator('summary').click();
  const headings = await allRuns(page).locator('h3').allTextContents();
  expect(headings).toEqual(['P1', 'P2', 'P3', 'P4', 'P5'].map((l, i) => `Wording ${i + 1}: Test fixture sent ${l}`));
  await expect(allRuns(page).locator('article')).toHaveCount(20);
});
