// F4: Help is by task, keeps #leaves, and says how badges are earned; the footer and About agree with it.
import { expect, test } from './guard.ts';

test('Help has a section for each task, keeps the #leaves anchor and says finishing does not earn a badge', async ({ page }) => {
  await page.goto('/help/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Help with Stillpool');
  for (const name of ['Start a lesson', 'Short or detailed explanations', 'Make reading comfortable', 'Listen to a lesson', 'Finish a lesson and earn a badge', 'Keep or move your progress', 'Restore or delete progress', 'Find a lesson', 'What leaves your device', 'Get help'])
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  await expect(page.locator('h2#leaves')).toHaveText('What leaves your device');
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(text).toContain('Finishing alone does not earn one.');
  expect(text).toContain('contact@neurobridgeedu.eu');
});

test('About says a badge is earned by doing the activity, not by finishing', async ({ page }) => {
  await page.goto('/about/');
  expect(((await page.locator('main').innerText()).replace(/\s+/g, ' '))).toContain('Finishing a lesson on its own does not earn one.');
});
