// The lesson rail navigates (Pool Band v2). Emanuel's finding in the mock-up: clicking a section on the left took him back
// to the top of the page. Here every rail link, on a long lesson, scrolls to its own section, which lands just below the
// sticky header; the address gets the hash, the section's heading takes keyboard focus, and Back returns.
import { expect, test, type Page } from './guard.ts';

const LESSON = '/learn/prompting/a-skill-is-a-written-procedure/';
const VIEWS = [
  { name: 'a laptop, with the sidebar', width: 1440, height: 900, open: false },
  { name: 'a phone, in the Contents disclosure', width: 390, height: 844, open: true },
];
const rail = (page: Page) => page.getByRole('navigation', { name: 'Contents' });
const headerBottom = (page: Page) => page.locator('.site-header').evaluate((h) => h.getBoundingClientRect().bottom);

const walk = async (page: Page, view: (typeof VIEWS)[number]) => {
  await page.setViewportSize({ width: view.width, height: view.height });
  await page.goto(LESSON);
  if (view.open) await rail(page).locator('.toc-all > summary').click();
  const links = rail(page).locator('.here a');
  const count = await links.count();
  expect(count, 'a long lesson has many sections').toBeGreaterThan(8);
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const id = (await link.getAttribute('href'))!.slice(1);
    expect((await link.boundingBox())!.height, `${id} link is 44 px tall`).toBeGreaterThanOrEqual(44);
    await link.click();
    await page.waitForTimeout(250); // a page that jumps back to the top a moment after the click is measured after it
    expect(new URL(page.url()).hash, `${id}: the hash`).toBe(`#${id}`);
    const target = page.locator(`[id="${id}"]`);
    await expect(target, `${id}: its heading takes focus`).toBeFocused();
    await expect.poll(async () => (await target.boundingBox())!.y, { message: `${id}: below the header`, timeout: 1500 }).toBeGreaterThanOrEqual((await headerBottom(page)) - 1);
    expect((await target.boundingBox())!.y, `${id}: inside the window, not off the bottom`).toBeLessThan(view.height);
    if (i > 1) expect(await page.evaluate(() => scrollY), `${id}: scrolled, not at the top`).toBeGreaterThan(0);
    seen.push(id);
  }
  // Back goes to the section before, at its place.
  await page.goBack();
  await page.waitForTimeout(250);
  expect(new URL(page.url()).hash).toBe(`#${seen[count - 2]}`);
  const before = page.locator(`[id="${seen[count - 2]}"]`);
  await expect.poll(async () => (await before.boundingBox())!.y, { timeout: 1500 }).toBeGreaterThanOrEqual((await headerBottom(page)) - 1);
  expect((await before.boundingBox())!.y).toBeLessThan(view.height);
};

for (const view of VIEWS)
  test(`every rail link scrolls to its section, below the header, with the hash, the focus and Back, on ${view.name}`, async ({ page }) => walk(page, view));

test('the rail marks the section you went to, and names the activity as the activity names itself', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LESSON);
  const named = rail(page).locator('.here .sub a');
  await expect(named).toHaveText('Try it: Skill card builder');
  await expect(page.locator('#part-try-it')).toContainText('Skill card builder');
  await rail(page).getByRole('link', { name: 'Sources' }).click();
  await expect(rail(page).locator('.here [aria-current="location"]')).toHaveText('Sources');
});

// Known bad, as every check here is proven both ways: a rail whose click sends the page back to the top, as the mock-up's did,
// must fail the very walk above. test.fail() makes this test pass only while the walk fails.
test('known bad: a click that sends the page back to the top fails the walk', async ({ page }) => {
  test.fail();
  await page.addInitScript(() => addEventListener('hashchange', () => setTimeout(() => scrollTo(0, 0), 50)));
  await walk(page, VIEWS[0]);
});
