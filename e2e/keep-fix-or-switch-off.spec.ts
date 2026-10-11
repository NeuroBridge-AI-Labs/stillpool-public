// 5.2's "Keep, fix or switch off?" (stage I, static) on the site build: the shell's five checks, predict first, our call at the
// default rate, the call moving as the reader changes the rate they accept (mouse and keyboard), and the text and no-JavaScript
// versions writing every call out. The words are the engine's, src/lib/keep-fix-or-switch-off.ts.
import { decide, DEFAULT_TOLERANCE, flipLine, NOTICE, REPORT, reportLines, TOLERANCES } from '../src/lib/keep-fix-or-switch-off.ts';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

const LESSON = '/learn/going-deeper/evaluation/';
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show our call' });
const result = (page: Page, k: number) => tryIt(page).locator(`.result[data-k="${k}"]`);
const rate = (page: Page, k: number) => tryIt(page).getByRole('radio', { name: `about 1 wrong in ${k}`, exact: true });
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|streak|points|level)\b/i;
const headline = (k: number) => `Our call at about 1 wrong in ${k}: ${decide(REPORT, k).call}.`;

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('predict first: our call waits for the pick and the reveal, then the default rate shows its call', async ({ page }) => {
  await page.goto(LESSON);
  for (const line of reportLines(REPORT)) await expect(tryIt(page).getByText(line, { exact: true })).toBeVisible();
  await expect(reveal(page)).toBeDisabled();
  await expect(result(page, DEFAULT_TOLERANCE)).toBeHidden();
  await tryIt(page).getByRole('radio', { name: 'Switch off', exact: true }).check();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toHaveText('You predicted Switch off.');
  await expect(result(page, DEFAULT_TOLERANCE)).toContainText(headline(DEFAULT_TOLERANCE));
  await expect(rate(page, DEFAULT_TOLERANCE)).toBeChecked();
});

test('one call at a time: each rate shows its own call and reasons and hides the other three, by mouse', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByRole('radio', { name: 'Keep', exact: true }).check();
  await reveal(page).click();
  await expect(tryIt(page).locator('.results')).toHaveAttribute('aria-live', 'polite');
  for (const k of TOLERANCES) {
    await rate(page, k).check();
    for (const other of TOLERANCES) await (other === k ? expect(result(page, other)).toBeVisible() : expect(result(page, other)).toBeHidden());
    await expect(result(page, k)).toContainText(headline(k));
    for (const r of decide(REPORT, k).reasons) await expect(result(page, k)).toContainText(r);
  }
  await expect(tryIt(page)).toContainText(flipLine(REPORT));
  await expect(tryIt(page)).toContainText(NOTICE);
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('about 1 wrong');
});

test('the whole task works by keyboard alone: arrows move the rate and the call moves with it', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByLabel('Read it as text instead').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space'); // Keep
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await page.keyboard.press('Tab'); // into the rate group, on the checked rate
  await expect(rate(page, DEFAULT_TOLERANCE)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(rate(page, 50)).toBeChecked();
  await expect(result(page, 50)).toBeVisible();
  await expect(result(page, DEFAULT_TOLERANCE)).toBeHidden();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(rate(page, 10)).toBeChecked();
  await expect(result(page, 10)).toContainText(headline(10));
});

test('the call moves while the report does not', async ({ page }) => {
  await page.goto(LESSON);
  expect(new Set(TOLERANCES.map((k) => decide(REPORT, k).call)).size).toBe(3);
  const report = tryIt(page).locator('ul').first();
  const before = await report.innerText();
  await tryIt(page).getByRole('radio', { name: 'Fix', exact: true }).check();
  await reveal(page).click();
  await expect(result(page, DEFAULT_TOLERANCE)).toContainText(decide(REPORT, DEFAULT_TOLERANCE).call);
  await rate(page, 5).check();
  await expect(result(page, 5)).toContainText(decide(REPORT, 5).call);
  await expect(result(page, DEFAULT_TOLERANCE)).toBeHidden();
  expect(await report.innerText()).toBe(before);
});

test('"Show interactives as text" writes all four calls out, with nothing to press', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  for (const k of TOLERANCES) await expect(result(page, k)).toContainText(headline(k));
  await expect(tryIt(page).getByRole('radio')).toBeHidden();
  await expect(reveal(page)).toBeHidden();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the report, all four calls and where the call moves are written out', async ({ page }) => {
    await page.goto(LESSON);
    for (const line of reportLines(REPORT)) await expect(tryIt(page).getByText(line, { exact: true })).toBeVisible();
    for (const k of TOLERANCES) await expect(result(page, k)).toContainText(headline(k));
    await expect(tryIt(page)).toContainText(flipLine(REPORT));
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(reveal(page)).toBeHidden();
  });
});

test('at 320 px nothing scrolls sideways, before and after the reveal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await flat()).toBe(true);
  await tryIt(page).getByRole('radio', { name: 'Fix', exact: true }).check();
  await reveal(page).click();
  expect(await flat()).toBe(true);
});
