// Search (plan T9.4, D12): Pagefind's index behind our own page; results are links with a plain-text excerpt.
import { globSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from './guard.ts';

test('a word from the lesson finds its link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Search' }).click();
  await page.getByRole('combobox', { name: 'Search the lessons' }).fill('patterns');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const results = page.getByRole('list', { name: 'Results' });
  await expect(results.getByRole('link').first()).toHaveAttribute('href', /^\/learn\/.+\/$/);
  await expect(results.locator('mark')).toHaveCount(0); // the excerpt is text, never markup
});

// F9: the type-ahead is a WAI-ARIA combobox over the lesson titles; arrow keys move, Enter opens, Escape closes, text stays.
test('typing "ite" lists lessons by title and narrows as you type', async ({ page }) => {
  await page.goto('/search/');
  const box = page.getByRole('combobox', { name: 'Search the lessons' });
  const options = page.getByRole('option');
  await box.pressSequentially('i');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  const before = await options.count();
  await box.pressSequentially('te'); // "it" now also matches "Check it before you use it"
  await expect(options).toHaveCount(1);
  expect(before).toBeGreaterThan(1);
  await expect(options.first()).toContainText('Iterate and check');
  await expect(box).not.toHaveAttribute('aria-activedescendant'); // nothing is selected until an arrow key
  await box.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await expect(box).toHaveAttribute('aria-activedescendant', (await options.first().getAttribute('id')) as string);
  await box.press('Escape');
  await expect(options).toHaveCount(0);
  await expect(box).toHaveValue('ite');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/learn\/prompting\/iterate-and-check\/$/);
});

test('a title option opens its lesson on a click, and Enter on free text still searches the lesson text', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const search = async () => ({ results: [] });' }));
  await page.goto('/search/');
  const box = page.getByRole('combobox', { name: 'Search the lessons' });
  await box.fill('tok');
  await page.getByRole('option', { name: /Tokens/ }).click();
  await expect(page).toHaveURL(/\/learn\/how-ai-works\/tokens\/$/);
  await page.goto('/search/');
  await box.fill('tok');
  await box.press('Enter');
  await expect(page.getByRole('status')).toHaveText('No lessons match "tok".');
  await expect(page.getByRole('option')).toHaveCount(0);
});

// The no-results branch of the page, with the index stubbed to find nothing: Pagefind matches a word by its start (the
// letter "x" in "xqzjvwkp"), so no real word is certain to match no lesson. The real index is used by the test above.
test('a search that finds nothing shows "No lessons match"', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const search = async () => ({ results: [] });' }));
  await page.goto('/search/');
  await page.getByRole('combobox', { name: 'Search the lessons' }).fill('xqzjvwkp');
  await page.getByRole('combobox', { name: 'Search the lessons' }).press('Enter');
  await expect(page.getByRole('status')).toHaveText('No lessons match "xqzjvwkp".');
  await expect(page.getByRole('list', { name: 'Results' }).getByRole('link')).toHaveCount(0);
});

// pr9-review SHOULD-FIX 2, p5-pr10-review-r2 SHOULD-FIX 1: the control labels are not lesson text, so the index (Pagefind's
// stored fragments, read here) holds none of them. A search box is no probe: Pagefind matches "listen" to "list".
test('the lesson controls are not indexed', () => {
  const indexed = globSync('dist/pagefind/fragment/*.pf_fragment').map((f) => gunzipSync(readFileSync(f)).toString()).join('\n');
  expect(indexed).toContain('caring tone');
  for (const label of ['Read aloud', 'Listen to', 'Reading depth for', 'SimpleDeep', 'Simple Deep']) expect(indexed, label).not.toContain(label);
});
