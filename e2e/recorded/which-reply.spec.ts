// "Which reply sounds caring?" (plan amendment, PR 11; the 1.1 brief), run on the fixture build (dist-fixture, built
// with RECORDED_FIXTURE=1 by playwright.config.ts): predict first, a full keyboard path, the text version, at most five
// items at 390 by 844, the summary before "show all runs", and no score or count.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/what-ai-is-and-is-not/';
// p6 D4: the summary a person writes lives beside the lesson, here the fixture's stand-in for its recorded.yaml.
const said = load(readFileSync('fixtures/recorded/recorded.yaml', 'utf8')) as Record<string, { summary: string }>;
const F = { ...JSON.parse(readFileSync('fixtures/recorded/R-1.1.json', 'utf8')), summary: said['R-1.1'].summary };
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show what happened' });

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('the replies show first; the instructions, the model and the summary wait for a pick', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText(F.message);
  for (const v of F.variants) await expect(tryIt(page).locator('.replies').getByText(v.runs[0].reply, { exact: true })).toBeVisible();
  await expect(reveal(page)).toBeDisabled();
  for (const hidden of [F.variants[0].instruction, F.model.name, F.summary]) await expect(tryIt(page).getByText(hidden).filter({ visible: true })).toHaveCount(0);
  await tryIt(page).getByRole('radio', { name: 'Reply 2' }).check();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toHaveText(`You picked Reply 2. It was told: ${F.variants[1].instruction}`);
  await expect(tryIt(page).getByText('Both replies came from the same AI.')).toBeVisible();
  await expect(tryIt(page).getByText(F.model.name, { exact: false }).first()).toBeVisible();
  await expect(tryIt(page).getByText(F.date.slice(0, 4), { exact: false }).first()).toBeVisible();
  for (const [name, value] of Object.entries(F.settings)) await expect(tryIt(page)).toContainText(`${name}: ${value}`);
  const said = await tryIt(page).innerText();
  expect(said).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer)\b/i);
});

test('the whole task works by keyboard, and "Show another run" cycles the recorded runs', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByRole('radio', { name: 'Reply 1' }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(reveal(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.picked')).toHaveText(`You picked Reply 1. It was told: ${F.variants[0].instruction}`);
  await expect(tryIt(page).locator('.picked'), 'focus keeps the place (p5-pr11-review NICE 1)').toBeFocused();
  const summary = tryIt(page).locator('summary', { hasText: 'Show all runs' });
  await summary.focus();
  await page.keyboard.press('Enter');
  for (const v of F.variants) for (const r of v.runs) await expect(tryIt(page).locator('details').getByText(r.reply)).toBeVisible();
  await tryIt(page).getByRole('button', { name: 'Show another run' }).focus();
  await page.keyboard.press('Enter');
  for (const v of F.variants) await expect(tryIt(page).locator('.replies').getByText(v.runs[1].reply)).toBeVisible();
});

test('the summary comes before "show all runs", and the runs stay folded until asked', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByRole('radio', { name: 'Reply 1' }).check();
  await reveal(page).click();
  await expect(tryIt(page).getByText(F.summary)).toBeVisible();
  const first = await tryIt(page).getByText(F.summary).evaluate((p) => {
    const runs = p.closest('.which-reply')?.querySelector('summary');
    return !!runs && !!(p.compareDocumentPosition(runs) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(first, 'the summary comes first').toBe(true);
  await expect(tryIt(page).locator('details').getByText(F.variants[0].runs[2].reply)).toBeHidden();
});

// p5-pr11-review SHOULD-FIX 1: side by side where the width allows (the brief's screen 3), stacked on a phone.
test('the two replies sit side by side at 1280 and one above the other at 390', async ({ page }) => {
  for (const [width, side] of [[1280, true], [390, false]] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(LESSON);
    const [a, b] = await tryIt(page).locator('.replies > li').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    expect(side ? a.top === b.top && b.left >= a.right : b.top >= a.bottom, `${width}`).toBe(true);
  }
});

test('at 390 by 844 it offers at most five items at once, each 44 px tall, and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(LESSON);
  const items = await tryIt(page).locator('input, button, summary').evaluateAll((els) => els.filter((e) => (e as HTMLElement).checkVisibility()).length);
  expect(items).toBeGreaterThan(0);
  expect(items).toBeLessThanOrEqual(5);
  await tryIt(page).getByRole('radio', { name: 'Reply 1' }).check();
  await reveal(page).click();
  const small = await tryIt(page).locator('label, button, summary').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).checkVisibility() && e.getBoundingClientRect().height < 44).map((e) => e.textContent?.trim()),
  );
  expect(small, 'every target is at least 44 px tall').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('"Show interactives as text" shows every step as text, with nothing to press', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  for (const text of [F.message, F.variants[0].runs[0].reply, 'Which reply seems to understand you better?', F.variants[1].instruction, F.model.name, F.summary])
    await expect(tryIt(page).getByText(text, { exact: false }).first()).toBeVisible();
  await expect(tryIt(page).getByRole('radio')).toBeHidden();
  await expect(reveal(page)).toBeHidden();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the text version is what shows', async ({ page }) => {
    await page.goto(LESSON);
    for (const text of [F.variants[1].runs[0].reply, F.variants[0].instruction, F.summary]) await expect(tryIt(page).getByText(text).first()).toBeVisible();
    await expect(reveal(page)).toBeHidden();
  });
});
