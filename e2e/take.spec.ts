// "Emanuel's take" (design sheet 4): a closed native <details> between the Check-in and Sources, its kicker showing while
// closed, the paragraphs and the byline inside; the rail lists it; a lesson without one has no part-take.
import { expect, test, type Page } from './guard.ts';

const parts = (page: Page) => page.locator('main [data-part]').evaluateAll((els) => els.map((el) => el.getAttribute('data-part')));
const railLinks = (page: Page) => page.getByRole('navigation', { name: 'Contents' }).locator('.here a').allTextContents();

test('a take sits after the Check-in, is closed, opens with the keyboard, and is in the rail', async ({ page }) => {
  await page.goto('/learn/how-ai-works/what-ai-is-and-is-not/');
  const order = await parts(page);
  expect(order.slice(order.indexOf('checkin'), order.indexOf('checkin') + 3)).toEqual(['checkin', 'take', 'sources']);
  const take = page.locator('[data-part="take"]');
  await expect(take.locator('details')).not.toHaveAttribute('open');
  await expect(take.locator('summary > h2#part-take')).toHaveText("Emanuel's take");
  await expect(take.locator('summary > .kicker'), 'the kicker shows while the take is closed').toHaveText(/^Opinion\. .*one person's view\.$/);
  await expect(take.locator('p:not(.kicker, .byline)').first()).toBeHidden();
  await take.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(take.locator('details')).toHaveAttribute('open', '');
  await expect(take.locator('p:not(.kicker, .byline)').first()).toBeVisible();
  await expect(take.locator('.byline')).toHaveText('Emanuel Covasa');
  await expect(take.locator('button, a, input, textarea'), 'no reply, reaction or count').toHaveCount(0);
  expect(await railLinks(page)).toContain("Emanuel's take");
});

test("Pillar 3's opening lesson shows its take open, straight after In short", async ({ page }) => {
  await page.goto('/learn/ethics/who-shapes-what-ai-shows/');
  const order = await parts(page);
  expect(order.slice(order.indexOf('tldr'), order.indexOf('tldr') + 3)).toEqual(['tldr', 'take', 'core']);
  await expect(page.locator('[data-part="take"] details')).toHaveAttribute('open', '');
  const links = await railLinks(page);
  expect(links.slice(0, 2)).toEqual(['In short', "Emanuel's take"]);
});

test('a lesson without a take has no take part and no rail link for it', async ({ page }) => {
  await page.goto('/learn/how-ai-works/rules-or-examples/');
  expect(await parts(page)).not.toContain('take');
  await expect(page.locator('#part-take')).toHaveCount(0);
  expect(await railLinks(page)).not.toContain("Emanuel's take");
});
