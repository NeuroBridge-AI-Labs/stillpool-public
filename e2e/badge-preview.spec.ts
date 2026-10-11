// "Earning a badge" on the home page (fix round 5, F8): an example only. Preview shows the sample badge and Reset hides it,
// progress is never read or written, hiding progress hides the demo, and reduced motion draws nothing.
import { expect, type Page, test } from './guard.ts';

const stored = (page: Page) => page.evaluate(() => localStorage.getItem('nbl:progress'));

test('Preview shows the sample badge and Reset takes it away, without touching progress', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('.badge-preview');
  await expect(section.getByRole('heading', { level: 2, name: 'Earning a badge' })).toBeVisible();
  await expect(section).toContainText('Example preview. This does not change your progress.');
  const earned = section.locator('.closeup');
  await expect(earned).toBeHidden();
  await section.getByRole('button', { name: 'Preview earned badge' }).click();
  await expect(earned).toBeVisible();
  await expect(section.locator('#preview-status')).toHaveText('Preview shown');
  await section.getByRole('button', { name: 'Reset the preview' }).click();
  await expect(earned).toBeHidden();
  await expect(section.locator('#preview-status')).toHaveText('Preview reset');
  expect(await stored(page)).toBeNull();
  await expect(page.locator('.map .can-do')).toBeHidden(); // the real collection never saw the preview
});

test('the emblem is drawn once on Preview, and not at all under reduced motion', async ({ page }) => {
  await page.goto('/');
  const closeup = page.locator('.badge-preview .closeup');
  await page.getByRole('button', { name: 'Preview earned badge' }).click();
  await expect(closeup).toHaveClass(/playing/);
  await expect(closeup).not.toHaveClass(/playing/);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ motion: 'reduce' })));
  await page.reload();
  await page.getByRole('button', { name: 'Preview earned badge' }).click();
  await expect(closeup).not.toHaveClass(/playing/);
});

test('hiding progress hides the demo and leaves a plain note', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ progress: 'hide' })));
  await page.goto('/');
  await expect(page.locator('.preview-demo')).toBeHidden();
  await expect(page.locator('.preview-hidden')).toBeVisible();
});

test('on a phone the preview has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preview earned badge' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
