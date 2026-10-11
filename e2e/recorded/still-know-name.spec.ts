import { existsSync } from 'node:fs';
import { WORDS } from '../../src/lib/still-know-name.ts';
import { expect, test } from '../guard.ts';
test('with no R-1.8 recording, the Try it part shows only the pending note', async ({ page }) => {
  expect(existsSync('fixtures/recorded/R-1.8.json')).toBe(false);
  await page.goto('/learn/how-ai-works/attention-and-the-context-window/');
  const tryIt = page.locator('[data-part="tryit"]');
  await expect(tryIt.locator('p')).toHaveText(WORDS.pending);
  await expect(tryIt.locator('input, details, .msg, .run')).toHaveCount(0);
  await expect(page.locator('[data-part="core"]')).not.toContainText('The summary above says what the recorded answers showed.');
  await expect(page.locator('[data-part="core"]')).not.toContainText('In the activity above, we did the cutting ourselves');
});
