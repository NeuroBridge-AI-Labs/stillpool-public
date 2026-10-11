// W2: recorded answers as cards, transcripts as speaker rows, and feedback beside the choice it answers, on the real build.
// A long answer shows an excerpt and keeps the rest in a native disclosure; the full text is there without JavaScript and as text.
import { expect, type Page, test } from './guard.ts';

const PROMPTS = '/learn/prompting/bad-and-good-prompts/';
const SKILL = '/learn/prompting/a-skill-is-a-written-procedure/';
const long = (page: Page) => page.locator('.run:has(details.rest)').first();

test('a long answer shows an excerpt, and the disclosure names the model and run and follows the whole answer', async ({ page }) => {
  await page.goto(PROMPTS);
  const card = long(page);
  const summary = card.locator('details.rest > summary');
  const label = (e: Element) => getComputedStyle(e, '::before').content;
  expect(await card.locator('.cut').first().evaluate(label)).toContain('Excerpt');
  await expect(card.locator('details.rest .reply')).toBeHidden();
  await expect(summary).toHaveAccessibleName(/^Read the full recorded answer ?, .+, run \d$/);
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await summary.click();
  await expect(card.locator('details.rest .reply')).toBeVisible();
  expect(await card.locator('.cut').first().evaluate(label)).not.toContain('Excerpt');
  await expect(summary).toHaveAccessibleName(/^Show only the excerpt ?, .+, run \d$/);
  const [rest, button] = await Promise.all([card.locator('details.rest .reply').boundingBox(), summary.boundingBox()]);
  expect(button!.y, 'the button follows the answer').toBeGreaterThan(rest!.y + rest!.height - 1);
});

test('the full answer is in the page without JavaScript and as text', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(PROMPTS);
  await expect(long(page).locator('details.rest .reply')).toBeVisible();
  await expect(long(page).locator('details.rest > summary')).toBeHidden();
  await context.close();
  const text = await browser.newContext();
  const page2 = await text.newPage();
  await page2.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page2.goto(PROMPTS);
  await expect(long(page2).locator('details.rest .reply')).toBeVisible();
  expect(await long(page2).locator('.cut').first().evaluate((e) => getComputedStyle(e, '::before').content)).not.toContain('Excerpt');
  await text.close();
});

test('every false part is highlighted with its reason under the answer, and the highlight carries a word', async ({ page }) => {
  await page.goto(PROMPTS);
  for (const group of await page.locator('[data-shell] fieldset').all()) await group.locator('input[type=radio]').first().check();
  await page.locator('[data-reveal]').click();
  const card = page.locator('.run:visible:has(mark)').first();
  await expect(card.locator('mark').first()).toBeVisible();
  await expect(card.locator('.note.bad').first()).toContainText('Not true:');
  expect(await card.locator('mark').first().evaluate((e) => getComputedStyle(e, '::after').content)).toBe('"Not true"');
});

test('a transcript is one speaker per row, each row with the name and an initial', async ({ page }) => {
  await page.goto(SKILL);
  const rows = page.locator('ol.transcript').first().locator('li');
  expect(await rows.count()).toBe(13);
  await expect(rows.nth(0)).toContainText('Priya');
  await expect(rows.nth(1)).toContainText('Jonah');
  const [a, b] = await Promise.all([rows.nth(0).boundingBox(), rows.nth(1).boundingBox()]);
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
  for (const row of await rows.all()) {
    await expect(row.locator('.who strong')).not.toBeEmpty();
    await expect(row.locator('.who b')).toHaveAttribute('aria-hidden', 'true');
  }
  const colours = await rows.evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).borderLeftColor))]);
  expect(colours.length, 'five speakers, five colours').toBe(5);
});

test('after the reveal each question says "Your prediction" and "What happened" beside it', async ({ page }) => {
  await page.goto(PROMPTS);
  const shell = page.locator('[data-shell]');
  for (const group of await shell.locator('fieldset').all()) await group.locator('input[type=radio]').first().check();
  await shell.locator('[data-reveal]').click();
  for (const group of await shell.locator('fieldset').all()) {
    await expect(group.locator('.feedback')).toContainText('Your prediction.');
    await expect(group.locator('.feedback')).toContainText('What happened.');
  }
  await expect(shell.locator('.picked')).toBeFocused();
});

// Fix round 1 (S2): the button follows the whole answer, so keyboard focus must follow the reader: to the start of what was
// just shown on opening, and the button itself is brought back into view on closing.
for (const [width, height] of [[1440, 900], [390, 844]])
  test(`opening a long answer from the keyboard keeps focus in view below the header, and closing keeps the button in view at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(PROMPTS);
    const summary = long(page).locator('details.rest > summary');
    const inView = () => page.evaluate(() => {
      const r = document.activeElement!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, header: document.querySelector('.site-header')!.getBoundingClientRect().bottom, height: innerHeight };
    });
    await page.keyboard.press('Tab'); // keyboard modality
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(long(page).locator('details.rest .reply')).toBeVisible();
    await expect(long(page).locator('details.rest .reply > *').first()).toBeFocused();
    const opened = await inView();
    expect(opened.top, 'below the header').toBeGreaterThanOrEqual(opened.header);
    expect(opened.top, 'in the window').toBeLessThan(opened.height);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(long(page).locator('details.rest .reply')).toBeHidden();
    await expect(summary).toBeFocused();
    const closed = await inView();
    expect(closed.top, 'below the header').toBeGreaterThanOrEqual(closed.header);
    expect(closed.bottom, 'in the window').toBeLessThanOrEqual(closed.height);
  });
