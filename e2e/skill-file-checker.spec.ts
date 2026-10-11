// 5.4's "Skill-file checker" (stage I, an engine) on the site build: the shell's five checks, predict first, the engine run
// in the browser on the three files, the same words as the text version, and the Deep part that checks pasted text.
import { SAMPLES, check, html, verdict } from '../src/lib/skill-file-checker.ts';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

const LESSON = '/learn/going-deeper/anatomy-of-a-skill-file/';
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Run the checker' });
const guess = (page: Page, file: string, name: string) => tryIt(page).locator(`label:has(input[name="skill-${file}"])`).filter({ hasText: name }).getByRole('radio');
const found = (page: Page, file: string) => tryIt(page).locator(`section[data-file="${file}"]`);
const own = (page: Page) => page.locator('.skill-own');
const DEEP = `${LESSON}?depth=deep`;
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak)\b/i;

const pickAll = async (page: Page) => {
  for (const [id, name] of [['A', 'Fails'], ['B', 'Passes'], ['C', "Can't tell"]]) await guess(page, id, name).check();
};
// A real Tab walk: press Tab until focus is in the target, never focus() it, so a control out of the tab order fails.
async function tabTo(page: Page, target: ReturnType<Page['locator']>) {
  for (let n = 0; n < 80; n++) {
    await page.keyboard.press('Tab');
    if (await target.first().evaluate((el) => el.contains(document.activeElement))) return;
  }
  throw new Error(`Tab never reached ${target}`);
}
const asText = (page: Page) => page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
const words = async (page: Page) => (await Promise.all(SAMPLES.map(({ id }) => found(page, id).innerText()))).join('\n');

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('predict first: the findings wait for a guess about every file and for the reveal, and each guess is said with its file', async ({ page }) => {
  await page.goto(LESSON);
  await expect(reveal(page)).toBeDisabled();
  await expect(found(page, 'A')).toBeHidden();
  await guess(page, 'A', 'Fails').check();
  await guess(page, 'B', 'Passes').check();
  await expect(reveal(page)).toBeDisabled();
  await guess(page, 'C', "Can't tell").check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toHaveText("File A: you predicted fails.\nFile B: you predicted passes.\nFile C: you predicted can't tell.");
  await expect(found(page, 'A')).toBeVisible();
});

test('the checker runs in the browser: the findings it draws are the engine\'s, for the file as shown', async ({ page }) => {
  await page.goto(LESSON);
  // The build drew the findings too; blank them, so only the browser run can put them back.
  await page.evaluate(() => document.querySelectorAll('.skill-file-checker section[data-file] dl').forEach((d) => (d.innerHTML = '')));
  await pickAll(page);
  await reveal(page).click();
  for (const { id, text } of SAMPLES) {
    await expect(found(page, id).locator('[data-verdict]')).toHaveText(verdict(check(text)));
    expect(await found(page, id).locator('dl').innerHTML()).toBe(html(check(text)));
    await expect(found(page, id).getByRole('term')).toHaveText(['Name', 'Description', 'Steps', 'Rules', 'Examples', 'Reference files']);
  }
  await expect(found(page, 'B').locator('dd[data-status="vague"]')).toHaveCount(1);
  await expect(found(page, 'B').locator('dd[data-status="vague"]')).toContainText('The description line does not use the word "when".');
  await expect(found(page, 'C').locator('dd:not([data-status="present"])')).toHaveCount(0);
  const text = await tryIt(page).innerText();
  expect(text).toContain('B looked complete and failed on one part: its description does not use the word "when".');
  expect(text).not.toMatch(SCORE);
  expect(text).not.toMatch(/promptsage/i);
});

test('the whole task works by keyboard alone: real Tab presses to every guess and the button', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByLabel('Read it as text instead').focus();
  for (const [id, key] of [['A', 'ArrowDown'], ['B', 'ArrowDown'], ['C', 'Space']]) {
    await tabTo(page, tryIt(page).locator(`input[name="skill-${id}"]`));
    await page.keyboard.press(key); // an arrow moves to the next radio and picks it; Space picks the first
  }
  await tabTo(page, reveal(page));
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(found(page, 'C').locator('[data-verdict]')).toHaveText('This file passes.');
});

test('as text, the same findings are written out for all three files with nothing to press', async ({ page }) => {
  await page.goto(LESSON);
  await pickAll(page);
  await reveal(page).click();
  const live = await words(page);
  await asText(page);
  await page.reload();
  await expect(reveal(page)).toBeHidden();
  await expect(tryIt(page).getByRole('radio')).toBeHidden();
  expect(await words(page)).toBe(live);
  for (const { id, text } of SAMPLES) await expect(found(page, id)).toContainText(verdict(check(text)));
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the findings are written out, and the paste box is not offered', async ({ page }) => {
    await page.goto(DEEP);
    for (const { id, text } of SAMPLES) {
      await expect(found(page, id)).toBeVisible();
      await expect(found(page, id)).toContainText(verdict(check(text)));
    }
    await expect(own(page)).toBeHidden();
  });
});

test('the paste box is in the Deep layer only', async ({ page }) => {
  await page.goto(LESSON);
  await expect(own(page)).toBeHidden();
  await page.goto(DEEP);
  await expect(own(page)).toBeVisible();
});

test('own text: Check waits for text, the findings take focus, edits mark them out of date, clearing removes them', async ({ page }) => {
  await page.goto(DEEP);
  const area = own(page).getByLabel('Paste a skill file, up to 2,000 characters');
  const check_ = own(page).getByRole('button', { name: 'Check this text' });
  await expect(area).toHaveAttribute('maxlength', '2000');
  await expect(check_).toBeDisabled();
  await area.fill('   ');
  await expect(check_).toBeDisabled();
  await area.fill(SAMPLES[2].text);
  await expect(check_).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(check_).toBeFocused();
  await page.keyboard.press('Enter');
  const box = own(page).locator('.own-found');
  await expect(box).toBeFocused();
  await expect(box.locator('[data-verdict]')).toHaveText('This file passes.');
  await expect(own(page).locator('[data-stale]')).toBeHidden();
  await area.fill(SAMPLES[0].text);
  await expect(own(page).locator('[data-stale]')).toHaveText('These findings are for the text as it was when you last pressed Check.');
  await expect(box.locator('[data-verdict]')).toHaveText('This file passes.'); // the old findings stay until the next check
  await check_.click();
  await expect(box.locator('[data-verdict]')).toHaveText('This file fails.');
  await expect(own(page).locator('[data-stale]')).toBeHidden();
  await area.fill('');
  await expect(check_).toBeDisabled();
  await expect(box).toBeHidden();
  await expect(own(page)).toContainText('Your text stays in this page. Nothing is sent or saved. A reload clears it.');
});

test('own text is never put in the page as markup', async ({ page }) => {
  await page.goto(DEEP);
  await own(page).getByRole('textbox').fill('<img src=x>');
  await own(page).getByRole('button', { name: 'Check this text' }).click();
  await expect(own(page).locator('.own-found img')).toHaveCount(0);
});

test('at 320 px nothing scrolls sideways and the buttons are 44 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(DEEP);
  await pickAll(page);
  await reveal(page).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const wide = await page.evaluate(() => [...document.querySelectorAll('.skill-file-checker *, .skill-own *')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().right > innerWidth).length);
  expect(wide).toBe(0);
  const small = await tryIt(page).locator('button, input, textarea').evaluateAll((els) => els.filter((e) => e.checkVisibility() && e.getBoundingClientRect().height < 44 && (e as HTMLInputElement).type !== 'radio' && (e as HTMLInputElement).type !== 'checkbox').length);
  expect(small).toBe(0);
});
