// Lesson 1.3's "Token splitter" (its brief, Interactive; p6 D2): the shell's five checks; T5, the page shows what
// gpt-tokenizer's o200k_base gives inside this test process; T6, the tokeniser's chunk loads only for the box; each with
// its known-bad page, planted by rewriting the built page on its way in. Then the box's two messages.
import { globSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import axe from 'axe-core';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import { piece, spoken } from '../../src/lib/tokenizer.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/tokens/';
const ITEMS: string[] = JSON.parse(readFileSync('data/interactive/token-splitter.json', 'utf8'));
const CHUNK = /\/tokenizer\.[^/]*\.js$/;
const box = (page: Page) => page.locator('.token-splitter');
const own = (page: Page) => box(page).locator('.own');
const plant = (page: Page, from: string, to: string) =>
  page.route(`**${LESSON}`, async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, body: (await res.text()).replace(from, to) });
  });
const predictAll = async (page: Page) => {
  for (const input of await box(page).locator('fieldset input').all()) await input.fill('2');
  await box(page).getByRole('button', { name: 'Show the split' }).click();
};
const tryOwn = async (page: Page, words: string) => {
  await own(page).getByLabel('Nothing you type leaves this page or is kept.').fill(words);
  await own(page).getByLabel('How many pieces will this tokeniser cut it into?').fill('2');
  await own(page).getByRole('button', { name: 'Show the split' }).click();
};
const heard = (page: Page) => own(page).locator('[aria-live]');
// What a screen reader hears for each ID, the IDs from gpt-tokenizer here, each piece read on its own (brief T4).
const hears = (ids: number[]) => ids.map((id) => ((w, q) => `${w}${q && `"${q}"`}, number ${id}`)(...spoken(piece(id))));

// T5: every item's list, in words and in its visible IDs, is the tokeniser run in this process on the same five strings.
const t5 = async (page: Page) => {
  for (const [i, text] of ITEMS.entries()) {
    const list = box(page).locator(`ol[data-item="${i + 1}"]`);
    await expect(list.locator('.sr'), text).toHaveText(hears(encode(text)), { timeout: 1_000 });
    await expect(list.locator('.id'), text).toHaveText(encode(text).map((id) => `ID ${id}`), { timeout: 1_000 });
  }
};
// T6, before the box: the five predictions and the reveal ask for no tokenizer chunk.
const t6 = async (page: Page) => {
  const asked: string[] = [];
  page.on('request', (r) => CHUNK.test(new URL(r.url()).pathname) && asked.push(r.url()));
  await page.goto(LESSON);
  await predictAll(page);
  await page.waitForLoadState('networkidle');
  return asked;
};

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('T5: after the reveal, the five splits are what o200k_base gives here, read piece by piece', async ({ page }) => {
  await page.goto(LESSON);
  // p6-6-review S2: the reveal waits for whole numbers; predictAll's 2s then open it.
  for (const input of await box(page).locator('fieldset input').all()) await input.fill('2.5');
  await expect(box(page).getByRole('button', { name: 'Show the split' })).toBeDisabled();
  await predictAll(page);
  await t5(page);
  await expect(box(page).locator('.picked')).toContainText('"strawberry": you said 2 pieces. This tokeniser made 3.');
  await expect(box(page).getByText('the Irish sentence needed 14 more pieces')).toBeVisible();
});

test('T5 known-bad: a page that renders one wrong ID fails', async ({ page }) => {
  await plant(page, 'number 302<', 'number 303<');
  await page.goto(LESSON);
  await predictAll(page);
  await expect(t5(page)).rejects.toThrow();
});

test('T6: no tokenizer chunk through the five items and the reveal, exactly one after the first use of the box', async ({ page }) => {
  const asked = await t6(page);
  expect(asked).toEqual([]);
  await tryOwn(page, 'strawberry');
  await expect(heard(page)).toHaveText('You said 2 pieces. This tokeniser made 3. Your words became 3 pieces with this tokeniser.');
  await expect(own(page).locator('.sr')).toHaveText(hears([302, 1618, 19772]));
  await tryOwn(page, '🧑‍🎓');
  await expect(own(page).locator('.sr')).toHaveText(hears(encode('🧑‍🎓')));
  await expect(own(page).locator('.part')).toHaveCount(5);
  expect(asked).toHaveLength(1);
});

test('T6 known-bad: a page that loads the chunk with the items fails', async ({ page }) => {
  const [chunk] = globSync('dist/_astro/tokenizer.*.js');
  await plant(page, '</head>', `<script type="module" src="/_astro/${basename(chunk)}"></script></head>`);
  expect(await t6(page)).not.toEqual([]);
});

test('the box says so for text the tokeniser keeps for its own use, and when the tokeniser cannot load', async ({ page }) => {
  await page.route(CHUNK, (r) => r.fulfill({ contentType: 'text/javascript', body: 'throw new Error("offline")' }));
  await page.goto(LESSON);
  await predictAll(page);
  await tryOwn(page, 'cat');
  await expect(heard(page)).toHaveText('The tokeniser could not load, so this box cannot split your words right now. The five splits above still work.');
  await page.unrouteAll();
  await page.reload();
  await predictAll(page);
  await tryOwn(page, '<|endoftext|>');
  await expect(heard(page)).toHaveText('This tokeniser keeps that text for its own use, so it cannot split it here.');
});

// After the reveal and a use of the box (check:axe sees only the page as it loads), at 390 wide, in the four themes.
for (const theme of ['light', 'dark', 'contrast', 'device'])
  test(`no axe violation after the reveal and the box, in the ${theme} theme at 390 wide`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'device' ? 'dark' : 'light' });
    await page.addInitScript((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(LESSON);
    await predictAll(page);
    await tryOwn(page, 'Hello 🧑‍🎓 world');
    await expect(own(page).locator('.part')).toHaveCount(5);
    await page.evaluate(axe.source);
    const found = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
    expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every split is written out in words, the boxes and the box for your own words are not there', async ({ page }) => {
    await page.goto(LESSON);
    await t5(page);
    await expect(box(page).locator('.sr').first()).toBeVisible();
    await expect(box(page).locator('.box').first()).toBeHidden();
    await expect(own(page)).toBeHidden();
    await expect(box(page).locator('[lang="ga"]').first()).toBeVisible();
  });
});

test('no score, count about you, percentage or "correct" anywhere', async ({ page }) => {
  await page.goto(LESSON);
  await predictAll(page);
  expect(await box(page).innerText()).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer)\b/i);
});
