// 3.2's "Sort the dataset" (stage I, an engine) on the site build: the shell's five checks, predict first, the model's result
// in words worked out in the browser, the one data change retrains it, and the text and no-JavaScript versions say the same.
import { compare, lines, run, verdict, wrongIn } from '../src/lib/sort-the-dataset.ts';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

const LESSON = '/learn/ethics/bias/';
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show what the model learned' });
const retrain = (page: Page) => tryIt(page).getByRole('button', { name: 'Add brill examples and retrain' });
const first = (page: Page, name: string) => tryIt(page).locator('[data-step]').first().getByRole('radio', { name, exact: true });
const second = (page: Page, name: string) => tryIt(page).locator('.change').getByRole('radio', { name, exact: true });
const result = (page: Page, n: 1 | 3) => tryIt(page).locator(`.result[data-brills="${n}"]`);
// "score" is the fruit's squeeze score here, so only a score kept for the reader counts
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:correct|wrong answer|streak|points)\b|\byour score\b/i;
const words = (n: 1 | 3) => lines(run(n));
const [a, b] = [run(1), run(3)];

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('predict first: the result waits for the guess and the reveal, and the guess is said in words', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText('The model learns from 20 ambers and 10 brills. Which kind will it get wrong more often?');
  await expect(reveal(page)).toBeDisabled();
  await expect(result(page, 1)).toBeHidden();
  await first(page, 'Ambers').check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toHaveText(`${verdict('amber', a)} Ambers: ${wrongIn(a.amber)}. Brills: ${wrongIn(a.brill)}.`);
  await expect(result(page, 1)).toBeVisible();
});

test('the first result is worked out in the browser and is the lesson\'s: cut-off 5, no amber wrong, 4 brills wrong, 4 wrong in 40', async ({ page }) => {
  await page.goto(LESSON);
  await first(page, 'Brills').check();
  await reveal(page).click();
  await expect(result(page, 1)).toHaveAttribute('data-live', '');
  expect(await result(page, 1).locator('p').allTextContents()).toEqual(words(1));
  const text = await result(page, 1).innerText();
  for (const w of ['learned a cut-off: a fruit is sorted ripe at score 5 or more.', 'Ambers: 0 wrong in 20.', 'Brills: 4 wrong in 20, about 1 in 5.', 'Brills it got wrong had scores 5 and 6: not ripe, sorted ripe.', 'Overall: 4 wrong in 40, about 1 in 10.'])
    expect(text).toContain(w);
  expect(text).not.toMatch(SCORE);
});

test('the one data change retrains the model, and the group that is wrong flips', async ({ page }) => {
  await page.goto(LESSON);
  await first(page, 'Brills').check();
  await reveal(page).click();
  await expect(retrain(page)).toBeDisabled();
  await expect(tryIt(page).locator('.change-answer')).toBeHidden();
  await second(page, 'Ambers').check();
  await expect(retrain(page)).toBeEnabled();
  await retrain(page).click();
  await expect(tryIt(page).locator('.change-answer')).toBeFocused();
  await expect(tryIt(page).locator('.change-answer .yours')).toHaveText(verdict('amber', b));
  await expect(result(page, 3)).toHaveAttribute('data-live', '');
  expect(await result(page, 3).locator('p').allTextContents()).toEqual(words(3));
  const text = await result(page, 3).innerText();
  for (const w of ['sorted ripe at score 7 or more.', 'Ambers: 4 wrong in 20, about 1 in 5.', 'Brills: 0 wrong in 20.', 'Ambers it got wrong had scores 5 and 6: ripe, sorted not ripe.', 'Overall: 4 wrong in 40, about 1 in 10.'])
    expect(text).toContain(w);
  await expect(tryIt(page).locator('.change-answer')).toContainText(compare(a, b));
  await expect(retrain(page)).toBeHidden();
});

test('a reload gives the same result: nothing is random', async ({ page }) => {
  await page.goto(LESSON);
  for (let i = 0; i < 2; i++) {
    await first(page, 'About the same').check();
    await reveal(page).click();
    expect(await result(page, 1).locator('p').allTextContents()).toEqual(words(1));
    await page.reload();
  }
});

test('the toy says what it leaves out, and shows no score', async ({ page }) => {
  await page.goto(LESSON);
  await first(page, 'Ambers').check();
  await reveal(page).click();
  await expect(tryIt(page)).toContainText('This is a toy with invented fruit. It learns one number.');
  await expect(tryIt(page)).toContainText('More data about a group does not always move mistakes to another group.');
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
});

test('the whole task works by keyboard alone', async ({ page }) => {
  await page.goto(LESSON);
  await first(page, 'Brills').focus();
  await page.keyboard.press('Space');
  await reveal(page).focus();
  await page.keyboard.press('Enter');
  await second(page, 'Ambers').focus();
  await page.keyboard.press('Space');
  await retrain(page).focus();
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.change-answer')).toBeFocused();
  await expect(tryIt(page).locator('.change-answer .yours')).toHaveText(verdict('amber', b));
});

test.describe('as text, and without JavaScript', () => {
  const both = async (page: Page) => {
    for (const n of [1, 3] as const) for (const w of words(n)) await expect(result(page, n).getByText(w, { exact: true })).toBeVisible();
    await expect(tryIt(page)).toContainText(compare(a, b));
  };
  test('"Show interactives as text" writes both results out, with nothing to press', async ({ page }) => {
    await page.goto(LESSON);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    await both(page);
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(retrain(page)).toBeHidden();
  });
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('both results are written out from the build', async ({ page }) => {
      await page.goto(LESSON);
      await both(page);
      await expect(reveal(page)).toBeHidden();
      // t2 C1: with no JavaScript nothing is worked out in the browser, so the page must not say it is
      await expect(tryIt(page)).not.toContainText('in your browser');
      await expect(tryIt(page)).toContainText('These results follow from the examples above.');
    });
  });
});

test('at 320 px nothing scrolls sideways, before and after the retrain', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await flat()).toBe(true);
  await first(page, 'Ambers').check();
  await reveal(page).click();
  await second(page, 'Brills').check();
  await retrain(page).click();
  expect(await flat()).toBe(true);
});
