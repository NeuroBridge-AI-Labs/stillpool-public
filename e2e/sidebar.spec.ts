// The lesson sidebar hides and comes back (run 26, Emanuel 27-09-26). The choice is a setting, so it holds after a
// reload and on every lesson, and the lesson column then sits in the middle of the page.
import { pages } from '../checks/serve.ts';
import { expect, test } from './guard.ts';

test('at 1440 Hide contents hides the sidebar, centres the lesson, holds across pages, and Contents brings it back', async ({ page }) => {
  const [first, other] = pages('dist').filter((route) => route.startsWith('/learn/'));
  expect(other, 'two lessons to move between').toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(first);
  await expect(page.getByRole('navigation', { name: 'Contents' })).toHaveAttribute('id', 'contents');
  const sidebar = page.locator('nav#contents');
  const hide = page.getByRole('button', { name: 'Hide contents' });
  const show = page.getByRole('button', { name: 'Contents', exact: true });
  await expect(sidebar).toBeVisible();
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await expect(show).toBeHidden();
  await hide.click();
  await expect(sidebar).toBeHidden();
  await expect(show, 'focus moves to the button that brings it back').toBeFocused();
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('button[aria-controls="contents"]'), 'both buttons control the sidebar').toHaveCount(2);
  const main = (await page.locator('.article').boundingBox())!;
  expect(Math.abs(main.x + main.width / 2 - 720), 'the lesson column is centred').toBeLessThanOrEqual(24);
  for (const route of [first, other]) {
    await page.goto(route);
    await expect(sidebar, route).toBeHidden();
    await expect(show, route).toBeVisible();
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  await expect(page.getByRole('checkbox', { name: 'Contents sidebar in lessons' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await show.focus();
  await page.keyboard.press('Enter');
  await expect(sidebar).toBeVisible();
  await expect(hide).toBeFocused();
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
});
