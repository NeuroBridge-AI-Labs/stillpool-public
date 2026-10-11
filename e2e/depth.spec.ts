// Reading depth (plan T6.4, D5; spec 3.4): Simple always shows and Deep adds under it. One click flips every section,
// the choice is stored and shows in ?depth=, a section flips on its own, and without JavaScript both layers show.
import { pages } from '../checks/serve.ts';
import { expect, type Page, test } from './guard.ts';

const lesson = pages('dist').find((route) => route.startsWith('/learn/')) as string;
const layers = (page: Page, layer: string) => page.locator(`main [data-layer="${layer}"]`);
const allShown = async (page: Page, layer: string, shown: boolean) => {
  const seen = await layers(page, layer).evaluateAll((els) => els.map((el) => el.checkVisibility()));
  expect(seen.length).toBeGreaterThan(0);
  expect(seen, layer).toEqual(seen.map(() => shown));
};
const everySection = (page: Page) => page.getByRole('group', { name: 'Reading depth for every section' });

// Simple, then Deep under it, in document order inside every section.
const simpleThenDeep = (page: Page) =>
  page.locator('main [data-part="core"] h2').evaluateAll((hs) =>
    hs.map((h) => {
      const order: string[] = [];
      for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling)
        if (el instanceof HTMLElement && el.dataset.layer && el.checkVisibility()) order.push(el.dataset.layer);
      return order.join();
    }),
  ).then((orders) => orders.filter(Boolean)); // a heading with no layer after it (an activity's own) has nothing to flip

test('one click on the global group adds Deep under Simple in every section', async ({ page }) => {
  await page.goto(lesson);
  await allShown(page, 'simple', true);
  await allShown(page, 'deep', false);
  await everySection(page).getByRole('button', { name: 'Deep' }).click();
  await allShown(page, 'deep', true);
  await allShown(page, 'simple', true);
  expect((await simpleThenDeep(page)).every((order) => order === 'simple,deep')).toBe(true);
  await expect(everySection(page).getByRole('button', { name: 'Add Deep' })).toHaveAttribute('aria-pressed', 'true');
  await expect(everySection(page).getByRole('button', { name: 'Simple only' })).toHaveAttribute('aria-pressed', 'false');
  await everySection(page).getByRole('button', { name: 'Simple only' }).click();
  await allShown(page, 'deep', false);
  await allShown(page, 'simple', true);
});

// PR 4 NICE 1, pinned here where depth arrives: the dialog keeps depth, and depth keeps the dialog's settings.
test('the choice survives a reload and a Settings change, and keeps the other settings', async ({ page }) => {
  await page.goto(lesson);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ theme: 'dark' })));
  await page.reload();
  await everySection(page).getByRole('button', { name: 'Add Deep' }).click();
  const stored = async () => JSON.parse((await page.evaluate(() => localStorage.getItem('nbl:settings'))) ?? '{}');
  expect(await stored(), 'the flip keeps the theme').toEqual({ theme: 'dark', depth: 'deep' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Text size' }).getByLabel('Large', { exact: true }).check();
  await page.goto(lesson); // no ?depth= in the address: the stored choice alone
  await allShown(page, 'deep', true);
  expect(await stored(), 'the dialog keeps depth').toEqual({ theme: 'dark', depth: 'deep', size: '3' });
});

test('?depth=deep opens Deep, and a flip writes ?depth= into the address', async ({ page }) => {
  await page.goto(`${lesson}?depth=deep`);
  await allShown(page, 'deep', true);
  await allShown(page, 'simple', true);
  await everySection(page).getByRole('button', { name: 'Simple only' }).click();
  await allShown(page, 'deep', false);
  expect(new URL(page.url()).searchParams.get('depth')).toBe('simple');
});

test('flipping one section adds Deep under that section only, and Simple stays', async ({ page }) => {
  await page.goto(lesson);
  const groups = page.getByRole('group', { name: /^Reading depth for (?!every section)/ });
  expect(await groups.count()).toBeGreaterThan(1);
  await groups.first().getByRole('button', { name: 'Add Deep' }).click();
  await expect(groups.first().getByRole('button', { name: 'Add Deep' })).toHaveAttribute('aria-pressed', 'true');
  const orders = await simpleThenDeep(page);
  expect(orders).toEqual(orders.map((_, i) => (i === 0 ? 'simple,deep' : 'simple')));
  expect(new URL(page.url()).searchParams.has('depth'), 'a section flip is not stored (Q11)').toBe(false);
  await groups.first().getByRole('button', { name: 'Simple only' }).click(); // the section goes back
  await allShown(page, 'deep', false);
  // D5: a global flip clears the section flips (pr6-review SHOULD-FIX 2).
  await groups.first().getByRole('button', { name: 'Add Deep' }).click();
  await everySection(page).getByRole('button', { name: 'Simple only' }).click();
  await allShown(page, 'simple', true);
  await allShown(page, 'deep', false);
});

test('with Deep on everywhere, one section can go back to Simple only', async ({ page }) => {
  await page.goto(`${lesson}?depth=deep`);
  const first = page.getByRole('group', { name: /^Reading depth for (?!every section)/ }).first();
  await first.getByRole('button', { name: 'Simple only' }).click();
  const orders = await simpleThenDeep(page);
  expect(orders).toEqual(orders.map((_, i) => (i === 0 ? 'simple' : 'simple,deep')));
});

test('the depth buttons are reachable and pressed by keyboard', async ({ page }) => {
  await page.goto(lesson);
  const deep = everySection(page).getByRole('button', { name: 'Add Deep' });
  await deep.focus();
  await page.keyboard.press('Enter');
  await expect(deep).toHaveAttribute('aria-pressed', 'true');
  await allShown(page, 'simple', true);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  await expect(deep).toHaveAttribute('aria-pressed', 'false');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('both layers show and the depth groups are hidden', async ({ page }) => {
    await page.goto(lesson);
    await allShown(page, 'simple', true);
    await allShown(page, 'deep', true);
    await expect(page.getByRole('group', { name: /^Reading depth for / })).toHaveCount(0);
  });
});

// A section's flip ends where the player's walk ends: the activity's own Deep (2.5's layer explorer) follows the global choice only.
test('a section flip leaves the activity Deep alone', async ({ page }) => {
  await page.goto('/learn/prompting/format/');
  const explorer = page.locator('main .layer-explorer[data-layer="deep"]');
  const section = page.getByRole('group', { name: 'Reading depth for Ask for the shape' });
  await section.getByRole('button', { name: 'Add Deep' }).click();
  await expect(page.locator('main #ask-for-the-shape ~ [data-layer="deep"]').first()).toBeVisible();
  await expect(explorer, 'the section flip does not show the explorer').toBeHidden();
  await everySection(page).getByRole('button', { name: 'Add Deep' }).click();
  await expect(explorer).toBeVisible();
  await section.getByRole('button', { name: 'Simple only' }).click();
  await expect(explorer, 'the section flip does not hide the explorer').toBeVisible();
});
