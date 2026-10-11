// 1.1's "Which reply sounds caring?" on the real site, from the real recording (data/recorded/R-1.1.json, 27-09-26):
// run 1 of each instruction on screen, the summary before "Show all runs", all six runs behind it, the model, the date
// and every setting, all by keyboard from the top of the page. The leak check is its own spec (no-fixture-text).
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { SPECS } from '../scripts/record.ts';
import { recorded, recording, shownSetting } from '../src/lesson-schema.ts';
import { expect, test } from './guard.ts';

const R = recording.parse(JSON.parse(readFileSync('data/recorded/R-1.1.json', 'utf8')));
const SUMMARY = recorded.parse(load(readFileSync('content/how-ai-works/what-ai-is-and-is-not/recorded.yaml', 'utf8')))['R-1.1'].summary; // p6 D4
const spec = SPECS['R-1.1'];

test('the real recording, all by keyboard: run 1 of each, the pick, the model, date and settings, the summary first, then all six runs', async ({ page }) => {
  // The file's shape comes from the recorder, not from the file, so a lost run fails here (r11-review S3).
  expect(R.variants.map((v) => v.instruction), 'the instructions, in order').toEqual([...spec.instructions]);
  expect(R.variants.map((v) => v.runs.length), 'the runs for each instruction').toEqual(spec.instructions.map(() => spec.runs));
  await page.goto('/learn/how-ai-works/what-ai-is-and-is-not/');
  const tryIt = page.locator('[data-part="tryit"]');
  await expect(tryIt.locator('.replies [data-reply]')).toHaveText(R.variants.map((v) => v.runs[0].reply));
  const first = tryIt.getByRole('radio', { name: 'Reply 1' });
  await expect(first).toBeVisible();
  for (let i = 0; i < 200 && !(await first.evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(first, 'Tab reaches the first choice').toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(tryIt.getByRole('button', { name: 'Show what happened' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tryIt.locator('.picked')).toHaveText(`You picked Reply 1. It was told: ${R.variants[0].instruction}`);
  await expect(tryIt).toContainText(`The AI: ${R.model.name} (${R.model.id}), on ${R.model.host}. Recorded on 27 September 2026.`);
  for (const [name, value] of Object.entries(R.settings)) await expect(tryIt).toContainText(`${name}: ${shownSetting(value)}`);
  // Fact-check S2 (28-09-26): the omitted temperature is said as omitted, never as the model's default.
  await expect(tryIt).toContainText('temperature: not sent, and the value the service used was not recorded');
  await expect(tryIt).not.toContainText("model's default");
  const summary = tryIt.getByText(SUMMARY, { exact: true });
  await expect(summary).toBeVisible();
  const runs = tryIt.locator('details');
  expect(await summary.evaluate((p, d) => !!(p.compareDocumentPosition(d as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await runs.elementHandle()), 'the summary comes first').toBe(true);
  await expect(runs.locator('li').first()).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(runs.locator('summary', { hasText: 'Show all runs' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(runs.locator('li p')).toHaveText(R.variants.flatMap((v) => v.runs.map((r) => r.reply)));
  for (const li of await runs.locator('li').all()) await expect(li).toBeVisible();
});

// EMMI's browser test of the live site (27-09-26): six plain paragraphs hid where one reply ends. Each instruction's runs
// sit under it, each run in its own box named "Run 1" to "Run 3" (never "1 of 3"), with space between, in every theme.
test('"Show all runs" groups the runs under each instruction, each run boxed and named, in every theme at 390 wide', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark', 'contrast']) {
    await page.goto('/learn/how-ai-works/what-ai-is-and-is-not/');
    await page.evaluate((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    await page.reload();
    const tryIt = page.locator('[data-part="tryit"]');
    await tryIt.getByRole('radio', { name: 'Reply 1' }).check();
    await tryIt.getByRole('button', { name: 'Show what happened' }).click();
    await tryIt.locator('summary', { hasText: 'Show all runs' }).click();
    const groups = tryIt.locator('details .runs');
    await expect(groups).toHaveCount(R.variants.length);
    for (const [i, v] of R.variants.entries()) {
      await expect(groups.nth(i).locator('h4')).toHaveText(`Told: ${v.instruction}`);
      await expect(groups.nth(i).locator('li h5')).toHaveText(v.runs.map((_, n) => `Run ${n + 1}`));
      await expect(groups.nth(i).locator('li p')).toHaveText(v.runs.map((r) => r.reply));
    }
    const boxes = await tryIt.locator('details li').evaluateAll((lis) =>
      lis.map((li) => {
        const [s, r] = [getComputedStyle(li), li.getBoundingClientRect()];
        return { width: parseFloat(s.borderTopWidth), colour: s.borderTopColor, ground: getComputedStyle(document.body).backgroundColor, top: r.top, bottom: r.bottom };
      }),
    );
    for (const [n, box] of boxes.entries()) {
      expect(box.width, `${theme}: run ${n} has a border`).toBeGreaterThanOrEqual(1);
      expect(box.colour, `${theme}: run ${n}'s border shows`).not.toBe(box.ground);
      if (n) expect(box.top - boxes[n - 1].bottom, `${theme}: space above run ${n}`).toBeGreaterThanOrEqual(8);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}: nothing scrolls sideways`).toBe(true);
  }
});
