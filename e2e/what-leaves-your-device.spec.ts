// 3.3's "What leaves your device" (stage I) on the site build: the shell's five checks, predict first (three places), the
// answers after the reveal, then the live list of this page's own requests, read in the browser, with no request of its own.
import { CHAT, COUNT_NOTE, HOW_MANY, PLACES, SCOPE, WHY } from '../src/lib/what-leaves-your-device.ts';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

const LESSON = '/learn/ethics/privacy-where-your-words-go/';
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show what each place holds' });
const listButton = (page: Page) => tryIt(page).getByRole('button', { name: 'Show the list' });
const group = (page: Page, place: string) => tryIt(page).locator('fieldset', { has: page.getByText(place, { exact: true }) });
const pickAll = async (page: Page) => {
  await group(page, 'This chat').getByRole('radio', { name: 'Nothing', exact: true }).check();
  await group(page, 'Saved memory').getByRole('radio', { name: 'One line', exact: true }).check();
  await group(page, 'Company logs').getByRole('radio', { name: 'All four lines', exact: true }).check();
};
// The two guesses about the page itself: about how many, and who. The button waits for both.
const guess = async (page: Page, who: string, many = '5 to 20') => {
  await tryIt(page).locator('.leaves').getByRole('radio', { name: many, exact: true }).check();
  await tryIt(page).locator('.leaves').getByRole('radio', { name: who, exact: true }).check();
};
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak)\b/i;

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('the mock chat is four invented lines and says it is a toy', async ({ page }) => {
  await page.goto(LESSON);
  expect(await tryIt(page).locator('.chat li').allTextContents()).toEqual(CHAT);
  await expect(tryIt(page)).toContainText('This toy and its bot are invented. It follows our own rules, not any real product\'s.');
});

test('predict first: three guesses before the reveal, and the answers wait for it', async ({ page }) => {
  await page.goto(LESSON);
  await expect(reveal(page)).toBeDisabled();
  for (const p of PLACES) await expect(tryIt(page).getByText(p.text, { exact: false })).toBeHidden();
  await group(page, 'This chat').getByRole('radio', { name: 'Nothing', exact: true }).check();
  await group(page, 'Saved memory').getByRole('radio', { name: 'One line', exact: true }).check();
  await expect(reveal(page)).toBeDisabled();
  await group(page, 'Company logs').getByRole('radio', { name: 'All four lines', exact: true }).check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toHaveText(['This chat: you said it would hold nothing.', 'Saved memory: you said it would hold one line.', 'Company logs: you said it would hold all four lines.'].join('\n'));
  for (const p of PLACES) await expect(tryIt(page).getByText(`${p.name}: ${['Nothing', 'One line', 'All four lines'][p.holds]}. ${p.text}`)).toBeVisible();
  await expect(tryIt(page).getByText(WHY)).toBeVisible();
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
});

test('company logs show no number for how long they keep the lines', async ({ page }) => {
  await page.goto(LESSON);
  await pickAll(page);
  await reveal(page).click();
  const logs = await tryIt(page).locator('p', { hasText: 'Company logs:' }).last().innerText();
  expect(logs).toContain('we show no number');
  expect(logs).not.toMatch(/\d/);
});

test('the live list is this page\'s own requests, read in the browser, and pressing the button makes none', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => seen.push(r.url()));
  await page.goto(LESSON);
  await pickAll(page);
  await reveal(page).click();
  await expect(listButton(page)).toBeDisabled();
  await expect(tryIt(page).locator('.leaves-answer')).toBeHidden();
  // the button waits for BOTH guesses: how many, and who (t3 C4)
  await tryIt(page).locator('.leaves').getByRole('radio', { name: "Only to this site's own server.", exact: true }).check();
  await expect(listButton(page)).toBeDisabled();
  await guess(page, "Only to this site's own server.");
  await expect(listButton(page)).toBeEnabled();
  await page.waitForTimeout(500);
  const before = seen.length;
  // the browser's record is the page itself (navigation) and its files (resource): the page was missing from the old list (t3 C1)
  const entries = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map((e) => e.name));
  expect(entries.length).toBeGreaterThan(1);
  await listButton(page).click();
  await page.waitForTimeout(500);
  expect(seen.length).toBe(before);
  const answer = tryIt(page).locator('.leaves-answer');
  await expect(answer).toBeFocused();
  await expect(answer).toContainText("You picked: 5 to 20 things. Only to this site's own server.");
  await expect(answer).toContainText(`The browser's record for this page lists ${entries.length} entries, the page itself included.`);
  await expect(answer).toContainText(SCOPE);
  await expect(answer).toContainText("came from this site's own server.");
  await answer.locator('summary').click();
  const lines = await answer.locator('li').allTextContents();
  expect(lines).toHaveLength(entries.length);
  expect(lines.some((l) => l.startsWith(new URL(page.url()).pathname + ', '))).toBe(true); // the page itself is listed
  const origin = new URL(page.url()).origin;
  for (const line of lines) {
    expect(line).toMatch(/^\/.*, \d+ bytes$/); // a path on this site and a size, never contents
    expect(line).not.toContain('http');
  }
  expect(entries.every((e) => e.startsWith(`${origin}/`))).toBe(true);
  expect(await answer.innerText()).not.toMatch(SCORE);
});

test('a guess about who gets the requests is kept and shown, and the one count is on a finish page only', async ({ page }) => {
  await page.goto(LESSON);
  await pickAll(page);
  await reveal(page).click();
  await guess(page, 'To this site and to some other companies.');
  await listButton(page).click();
  await expect(tryIt(page).locator('.leaves-answer')).toContainText('You picked: 5 to 20 things. To this site and to some other companies.');
  // t3 C3: a finish page loads a script AND sends a message, so no fixed number of requests is promised
  await expect(tryIt(page).locator('.leaves')).toContainText(COUNT_NOTE);
});

test('the whole task works by keyboard alone', async ({ page }) => {
  await page.goto(LESSON);
  for (const [place, name] of [['This chat', 'Nothing'], ['Saved memory', 'One line'], ['Company logs', 'All four lines']]) {
    await group(page, place).getByRole('radio', { name, exact: true }).focus();
    await page.keyboard.press('Space');
  }
  await reveal(page).focus();
  await page.keyboard.press('Enter');
  await tryIt(page).locator('.leaves').getByRole('radio', { name: HOW_MANY[0], exact: true }).focus();
  await page.keyboard.press('Space');
  await tryIt(page).locator('.leaves').getByRole('radio', { name: "I can't tell.", exact: true }).focus();
  await page.keyboard.press('Space');
  await listButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.leaves-answer')).toBeFocused();
  await expect(tryIt(page).locator('.leaves-answer')).toContainText("You picked: Fewer than 5 things. I can't tell.");
});

test.describe('as text, and without JavaScript', () => {
  test('"Show interactives as text" writes the answers out, and says the list needs the browser', async ({ page }) => {
    await page.goto(LESSON);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    for (const p of PLACES) await expect(tryIt(page).getByText(`${p.name}: ${['Nothing', 'One line', 'All four lines'][p.holds]}. ${p.text}`)).toBeVisible();
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(listButton(page)).toBeHidden();
    await expect(tryIt(page).locator('.leaves-answer .as-text')).toBeVisible();
    await expect(tryIt(page).locator('.leaves-answer .as-text a')).toHaveAttribute('href', '/help/');
  });
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every answer is written out, and the list says it needs the browser', async ({ page }) => {
      await page.goto(LESSON);
      for (const p of PLACES) await expect(tryIt(page).getByText(`${p.name}: ${['Nothing', 'One line', 'All four lines'][p.holds]}. ${p.text}`)).toBeVisible();
      await expect(tryIt(page).locator('.leaves-answer .as-text')).toBeVisible();
      await expect(reveal(page)).toBeHidden();
    });
  });
});

test('at 320 px nothing scrolls sideways, before and after the list', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await flat()).toBe(true);
  await pickAll(page);
  await reveal(page).click();
  await guess(page, "I can't tell.");
  await listButton(page).click();
  await tryIt(page).locator('.leaves-answer summary').click();
  expect(await flat()).toBe(true);
});
