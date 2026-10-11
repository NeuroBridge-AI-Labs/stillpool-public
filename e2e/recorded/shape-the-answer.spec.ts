// 2.5's "Shape the answer" (stage I, R-2.5) on the fixture build: the shared checks for the recorded part, and the
// layer explorer, which is for the Deep layer only, labelled invented, and never scored.
import { built, LAYERS, RULES } from '../../src/lib/layer-explorer.ts';
import { expect, type Page, test } from '../guard.ts';
import { fixture, p2Checks, reply } from '../p2.ts';

const LESSON = '/learn/prompting/format/';
const rec = fixture(5);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const explorer = (page: Page) => page.locator('.layer-explorer');

p2Checks({
  lesson: LESSON, n: 5, picks: ['shape-table|Yes, a table.', 'shape-named|A table only, with the four columns, and a much shorter answer.', 'shape-twice|No, three bullets either way.'],
  before: ['Test fixture sent A', 'Test fixture sent B'],
  after: [r('A', 'A', 1), r('B', 'B', 1), r('D2', 'A', 1)],
});

test('the long-message pair starts with the two runs that have smaller bullets: the rule once, run 2, and twice, run 1', async ({ page }) => {
  await page.goto(LESSON);
  for (const p of ['shape-table|Yes, a table.', 'shape-named|A table only, with the four columns, and a much shorter answer.', 'shape-twice|No, three bullets either way.']) await page.locator(`label:has(input[name="${p.split('|')[0]}"])`).filter({ hasText: p.split('|')[1] }).getByRole('radio').check();
  await page.getByRole('button', { name: 'Show what happened' }).click();
  const pair = page.locator('.runs-pair').nth(2);
  await expect(pair.getByText(r('D1', 'A', 2), { exact: true })).toBeVisible();
  await expect(pair.getByText(r('D2', 'A', 1), { exact: true })).toBeVisible();
  await expect(pair.getByText(r('D1', 'A', 1), { exact: true })).toHaveCount(0);
});

test('the explorer is in the Deep layer only', async ({ page }) => {
  await page.goto(LESSON);
  await expect(explorer(page)).toBeHidden();
  await page.goto(`${LESSON}?depth=deep`);
  await expect(explorer(page)).toBeVisible();
  await expect(explorer(page)).toContainText('Invented, not a model answer.');
  await expect(explorer(page).locator('.layer-answer')).toBeHidden();
});

test('a layer for each rule, then the layers and the built prompt, with nothing scored', async ({ page }) => {
  await page.goto(`${LESSON}?depth=deep`);
  const build = explorer(page).getByRole('button', { name: 'Show the layers' });
  const selects = explorer(page).locator('select');
  await expect(selects).toHaveCount(8);
  await expect(build).toBeDisabled();
  for (const [i, rule] of RULES.entries()) {
    if (i === RULES.length - 1) await expect(build).toBeDisabled(); // one rule still has no layer
    await selects.nth(i).selectOption(String(i === 1 ? 1 : rule.layer)); // rule 2 (index 1) is put in layer 1
  }
  await expect(build).toBeEnabled();
  await build.focus();
  await page.keyboard.press('Enter');
  const answer = explorer(page).locator('.layer-answer');
  await expect(answer).toBeFocused();
  await expect(answer.locator('li[data-rule="0"] .yours')).toHaveText('You chose this layer.');
  await expect(answer.locator('li[data-rule="1"] .yours')).toHaveText('You chose layer 1.');
  await expect(answer.locator('li[data-rule="7"] .yours')).toHaveText('You chose this layer.');
  await expect(answer.locator('li[data-rule="0"]')).toContainText(`${RULES[0].rule} Layer 1, ${LAYERS[0]}. ${RULES[0].reason}`);
  await expect(answer.locator('blockquote')).toHaveText(built());
  expect(await explorer(page).innerText()).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer)\b/i);
});

test('as text, every rule, its layer and the built prompt are written out, and nothing is left to choose', async ({ page }) => {
  await page.goto(`${LESSON}?depth=deep`);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on', depth: 'deep' })));
  await page.reload();
  await expect(explorer(page).locator('select:visible')).toHaveCount(0);
  await expect(explorer(page).getByRole('button', { name: 'Show the layers' })).toBeHidden();
  await expect(explorer(page).locator('.layer-answer')).toBeVisible();
  for (const x of RULES) await expect(explorer(page).locator('.layer-answer')).toContainText(`${x.rule} Layer ${x.layer}`);
  await expect(explorer(page).locator('.layer-answer blockquote')).toHaveText(built());
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the explorer is written out, with its label', async ({ page }) => {
    await page.goto(LESSON);
    await expect(explorer(page)).toContainText('Invented, not a model answer.');
    await expect(explorer(page).locator('.layer-answer')).toBeVisible();
    await expect(explorer(page).locator('select:visible')).toHaveCount(0);
  });
});

test('at 320 px the explorer does not scroll sideways and its choices are 44 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${LESSON}?depth=deep`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const small = await explorer(page).locator('select, button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
});
