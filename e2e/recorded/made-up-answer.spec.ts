import { readFileSync } from 'node:fs';
import { expect, test } from '../guard.ts';
import { checkShell } from '../shell.ts';
const URL = '/learn/how-ai-works/why-they-make-things-up/';
const fixture = JSON.parse(readFileSync('fixtures/recorded/R-1.6.json', 'utf8'));
test('the fixture keeps each saved answer unchanged and shows checks after both picks', async ({ page }) => {
  await page.goto(URL);
  const shell = page.locator('.made-up-answer');
  const read = async (selector: string) => page.locator(selector).evaluateAll((els) => els.map((el) => [...el.querySelectorAll('[data-answer-line]')].map((line) => line.textContent).join('\n')));
  expect(await read('.made-up-answer [data-answer]')).toEqual([fixture.variants[0].runs[0].reply]);
  await shell.getByRole('radio', { name: 'Study 1' }).first().check();
  await expect(shell.locator('[data-reveal]')).toBeDisabled();
  await shell.getByRole('radio', { name: 'They sound the same' }).check();
  await shell.locator('[data-reveal]').click();
  await expect(shell.locator('[data-check]')).toHaveCount(3);
  await page.locator('.made-up-runs summary').click();
  expect(await read('.made-up-runs [data-answer]')).toEqual(fixture.variants.flatMap((v: any) => v.runs.map((r: any) => r.reply)));
});
test('the fixture shell works by keyboard and as plain text', ({ page }) => checkShell(page, URL));
