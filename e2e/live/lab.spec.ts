// The practice lab's full path with the real function and the real model (lab-spec G5), run by playwright.live.config.ts
// against the owner's scoped preview: LAB_LIVE=1 LIVE_URL=<preview> bunx playwright test -c playwright.live.config.ts e2e/live/lab.spec.ts.
// It spends one real exchange (about EUR 0.001), so it is skipped unless LAB_LIVE=1, and the site project never matches e2e/live.
import { expect, test } from '../guard.ts';

test.skip(process.env.LAB_LIVE !== '1', 'LAB_LIVE=1 spends one real exchange; set it only against the scoped preview');

test('one real exchange through the page shows the six fields', async ({ page }) => {
  test.setTimeout(60_000);
  const posts: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/lab/' && posts.push(r.url()));
  await page.goto('/lab/');
  await page.getByRole('button', { name: 'I understand. Start.' }).click();
  await page.getByRole('radio', { name: /^Context\./ }).check();
  await page.getByLabel('Your prompt').fill('Make a packing list for a two-day trip by train in winter. I travel with one small bag.');
  await page.getByLabel('Also show an improved version of my prompt').check();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeVisible({ timeout: 45_000 });
  const answer = page.locator('[data-answer]');
  // The six reply fields. `note` is null on an ordinary exchange, so its row is hidden then; the other five carry text.
  await expect(answer.locator('[data-field]')).toHaveCount(6);
  for (const field of ['ai_answer', 'worked', 'try_next', 'why', 'example_prompt'])
    await expect(answer.locator(`[data-field="${field}"]`), field).not.toHaveText('');
  const note = answer.locator('[data-field="note"]');
  if (await note.isVisible()) await expect(note).not.toHaveText('');
  expect(posts).toHaveLength(1);
});
