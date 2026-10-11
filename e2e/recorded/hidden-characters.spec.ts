// 2.2's "Find the hidden characters" (stage I, R-2.2) on the fixture build: the shared checks for the recorded part,
// the pasted texts and the token view for part 2. Part 2 is not recorded, so it reads the real texts and tokeniser.
import { SECRET, TEXT_A, TEXT_B } from '../../src/lib/hidden-characters.ts';
import { expect, type Page, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/context/';
const rec = fixture(2);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const PICKS = ['hidden-1|Answer 2', 'hidden-a|No, nothing is hidden.', 'hidden-b|Yes, text B hides something.', 'hidden-spell|A message in plain English.'];
const hidden = (s: string) => [...s].filter((c) => /\p{Cf}/u.test(c)).length;
const open = async (page: Page, picks = PICKS) => {
  await page.goto(LESSON);
  for (const p of picks) await radio(page, p).check();
  await reveal(page).click();
};

p2Checks({
  lesson: LESSON, n: 2, picks: PICKS,
  before: [r('A', 'B', 2), r('B', 'B', 1)],
  after: [r('A', 'A', 1), r('B', 'A', 1)],
});

test('the two answers are unlabelled until the reveal: no model, no note', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page).locator('article.run:visible')).toHaveCount(2);
  for (const t of [rec.model.name, 'Test fixture note A B run 2.', 'Test fixture note B B run 1.']) await expect(tryIt(page).getByText(t).filter({ visible: true })).toHaveCount(0);
});

test('a wrong pick for part 1 is told in words, and the right one too', async ({ page }) => {
  await open(page, ['hidden-1|Answer 1', ...PICKS.slice(1)]);
  await expect(tryIt(page).locator('.picked')).toContainText('you said answer 1 had the reading pasted in. It did not.');
  await open(page);
  await expect(tryIt(page).locator('.picked')).toContainText('you said answer 2 had the reading pasted in. It did.');
});

test('text A and text B look the same: text B holds 21 invisible code points, text A none', async ({ page }) => {
  await page.goto(LESSON);
  const [a, b] = await tryIt(page).locator('blockquote.sent').evaluateAll((els) => els.slice(1).map((e) => e.textContent ?? ''));
  expect(a).toBe(TEXT_A);
  expect(b).toBe(TEXT_B);
  expect([hidden(a), hidden(b)]).toEqual([0, 21]);
  expect(b.replace(/\p{Cf}/gu, '')).toBe(a);
});

test('the token view marks every hidden code point by name, and zooms in on each', async ({ page }) => {
  await open(page);
  const t = tryIt(page);
  await expect(t).toContainText(`They spell "${SECRET}"`);
  const sections = t.locator('section:has(> ol.pieces)');
  await expect(sections.first().locator('li.hit')).toHaveCount(0);
  const hits = sections.last().locator('li.hit');
  expect(await hits.count()).toBeGreaterThan(21); // a tag character is cut into several pieces
  await expect(hits.first().locator('.sr')).toContainText('hidden: zero width no-break space');
  await expect(sections.last().locator('li.hit .sr', { hasText: 'hidden: tag latin capital letter M' }).first()).toBeAttached();
  await expect(sections.last().locator('li.hit .flag').first()).toBeVisible();
  const zoom = t.locator('details.zoom');
  await expect(zoom.locator('ol li')).toHaveCount(0 + 21);
  await expect(zoom.locator('ol li').first()).toBeHidden();
  await zoom.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(zoom.locator('ol li').first()).toContainText('U+FEFF, zero width no-break space. After "');
  await expect(zoom.locator('ol li').nth(1)).toContainText('U+E004D, tag latin capital letter M.');
  await expect(zoom.locator('ol li').last()).toContainText('U+200B, zero width space.');
});

test('as text, the hidden characters are named in words and the zoom list is written out', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  const hit = tryIt(page).locator('section:has(> ol.pieces)').last().locator('li.hit .sr').first();
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('hidden: zero width no-break space');
  await expect(tryIt(page).locator('details.zoom ol li').first()).toBeVisible();
  await expect(tryIt(page).locator('li.hit .flag').first()).toBeHidden();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the hidden characters are named in words', async ({ page }) => {
    await page.goto(LESSON);
    await expect(tryIt(page).locator('details.zoom ol li').first()).toBeVisible();
    await expect(tryIt(page).locator('section:has(> ol.pieces)').last().locator('li.hit .sr').first()).toBeVisible();
  });
});
