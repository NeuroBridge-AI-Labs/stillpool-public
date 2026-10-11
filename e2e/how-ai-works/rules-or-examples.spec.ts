// Lesson 1.2's "Sort the messages" (its brief, Interactive; p6 D2): the shell's five checks, and every group the page
// shows equals src/lib/sort-messages.ts run on the committed file, so no result is typed in by hand.
import { readFileSync } from 'node:fs';
import { sortData, sortMessages } from '../../src/lib/sort-messages.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/rules-or-examples/';
const DATA = sortData.parse(JSON.parse(readFileSync('data/interactive/sort-the-messages.json', 'utf8')));
const SORTED = sortMessages(DATA).map((m, i) => ({ ...m, n: i + 1 }));
const box = (page: Page) => page.locator('.sort-messages');
const reveal = (page: Page) => box(page).getByRole('button', { name: 'Show what the rule did' });
const pick = (page: Page, i: number) => box(page).locator('fieldset').nth(i).getByRole('radio', { name: 'The rule catches it' }).check();

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

// p6-2-review S1: the text on what a rule does comes straight after the Try it (brief, Simple core step 5), so its
// examples never answer the prediction first.
test('the Try it comes before "A rule does exactly what it says"', async ({ page }) => {
  await page.goto(LESSON);
  const order = await page.locator('[data-part="tryit"] > h2, [data-part="core"] > h2').allTextContents();
  expect(order.slice(1, 4)).toEqual(['How learning from examples works', 'Try it: Sort the messages', 'A rule does exactly what it says']);
});

test('the groups for the rule and for the model, and the side-by-side lines, are the function run on the data file', async ({ page }) => {
  await page.goto(LESSON);
  for (const i of SORTED.keys()) await pick(page, i);
  await reveal(page).click();
  for (const by of ['rule', 'model'] as const)
    for (const [junk, caught, title] of [
      [true, true, `Junk the ${by} caught`],
      [true, false, `Junk the ${by} let through`],
      [false, true, `Not junk, but the ${by} caught it`],
      [false, false, `Not junk, and the ${by} let it through`],
    ] as const) {
      const want = SORTED.filter((m) => m.junk === junk && m[by] === caught).map((m) => `Message ${m.n}: ${m.text}`);
      const group = box(page).locator(`[data-group="${title}"]`);
      if (want.length) await expect(group.locator('li'), title).toContainText(want);
      else await expect(group, title).toHaveText('None');
    }
  const side = SORTED.map((m) => `We marked it ${m.junk ? 'junk' : 'not junk'}. The rule ${m.rule ? 'caught it' : 'let it through'}. The model ${m.model ? 'put it in junk' : 'did not put it in junk'}.`);
  await expect(box(page).locator('.side li')).toContainText(side);
});

test('predict first: the reveal waits for all five, then each pick and what the rule did is said in words', async ({ page }) => {
  await page.goto(LESSON);
  for (const i of [0, 1, 2, 3]) await pick(page, i);
  await expect(reveal(page)).toBeDisabled();
  await expect(box(page).getByText('Junk the rule caught')).toBeHidden();
  await pick(page, 4);
  await reveal(page).click();
  const said = SORTED.map((m) => `Message ${m.n}: you said the rule catches it. The rule ${m.rule ? 'caught it' : 'let it through'}.`);
  await expect(box(page).locator('.picked')).toHaveText(said.join('\n'));
  await expect(box(page).locator('[data-group="Junk the rule caught"] li').first()).toContainText('You said the rule catches it.');
});

test('the examples it learned from show five at a time, with Next and Back and no count', async ({ page }) => {
  await page.goto(LESSON);
  for (const i of SORTED.keys()) await pick(page, i);
  await reveal(page).click();
  const examples = box(page).locator('.examples');
  const open = examples.getByRole('button', { name: 'See the examples it learned from' });
  await open.click();
  // p6-3-review N2: the button names the block it opens.
  await expect(page.locator(`#${await open.getAttribute('aria-controls')}`).getByRole('listitem').first()).toBeVisible();
  const seen = new Set<string>();
  for (let turn = 0; turn < 4; turn++) {
    const shown = await examples.locator('li').filter({ visible: true }).allInnerTexts();
    expect(shown.length).toBeLessThanOrEqual(5);
    for (const text of shown) seen.add(text.replace(/ \(we marked it (?:not )?junk\)$/, ''));
    await examples.getByRole('button', { name: 'Next' }).click();
  }
  expect([...seen].sort()).toEqual(DATA.examples.map((e) => e.text).sort());
  await examples.getByRole('button', { name: 'Back' }).click();
  await expect(examples.locator('li').filter({ visible: true }).last()).toContainText(DATA.examples.at(-1)?.text ?? '');
  expect(await examples.innerText()).not.toMatch(/\b\d+ (?:of|out of) \d+\b/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every step is text: the rule, the five messages, both results, all the examples and the sentence', async ({ page }) => {
    await page.goto(LESSON);
    for (const text of ['Rule: if a message has the word "free" in it, it goes in junk.', 'Both made mistakes']) await expect(box(page).getByText(text)).toBeVisible();
    for (const name of ['What the rule did', 'What the model did']) await expect(box(page).getByRole('heading', { name })).toBeVisible();
    for (const m of SORTED) await expect(box(page).getByText(`Message ${m.n}: ${m.text}`).first()).toBeVisible();
    for (const e of DATA.examples) await expect(box(page).getByText(e.text)).toBeVisible();
    await expect(box(page).getByRole('radio').first()).toBeHidden();
    await expect(reveal(page)).toBeHidden();
  });
});

test('no score, count, chance or "correct" anywhere, and the one sentence is there', async ({ page }) => {
  await page.goto(LESSON);
  for (const i of SORTED.keys()) await pick(page, i);
  await reveal(page).click();
  const text = await box(page).innerText();
  expect(text).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|chance|probability)\b/i);
  expect(text).toContain('Both made mistakes: the rule checks only for its one word, and the model learned only from our examples.');
});
