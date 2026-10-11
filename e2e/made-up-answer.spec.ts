import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { markdownToMdast, type MdastNode } from 'satteri';
import { checkText, featured } from '../src/lib/made-up-answer.ts';
import { expect, test } from './guard.ts';
import { checkShell } from './shell.ts';
const URL = '/learn/how-ai-works/why-they-make-things-up/';
const rec = JSON.parse(readFileSync('data/recorded/R-1.6.json', 'utf8'));
const checks = (load(readFileSync('content/how-ai-works/why-they-make-things-up/recorded.yaml', 'utf8')) as any)['R-1.6'].answers;
// Compare every recorded word, ignoring Markdown syntax that is now represented by HTML.
const words = (node: MdastNode): string => 'value' in node ? node.value : 'children' in node ? node.children.map(words).join('') : '';
const plain = (reply: string) => reply.split('\n').map((line) => words(markdownToMdast(line))).join('\n');
const same = (shown: string[], fixed: string[]) => shown.length === fixed.length && shown.every((s, k) => s.startsWith(fixed[k]));
test('the shell permits both predictions by keyboard and offers a text version', ({ page }) => checkShell(page, URL));
test('the real answers, model ids, UTC calls and line checks come from the saved files', async ({ page }) => {
  await page.goto(URL);
  const shell = page.locator('.made-up-answer');
  // p6-15-review S4: every run's checks stay hidden until the reveal.
  await expect(page.locator('.made-up-runs')).toBeHidden();
  await expect(shell.locator('[data-reveal]')).toBeDisabled();
  await shell.getByRole('radio', { name: 'Study 1' }).first().check();
  await expect(shell.locator('[data-reveal]')).toBeDisabled();
  await shell.getByRole('radio', { name: 'They sound the same' }).check();
  await shell.locator('[data-reveal]').click();
  await expect(shell.locator('.picked')).toContainText('You picked Study 1.');
  // N7: the featured answer is the stored text of the run the rule picks, with the Mistral default read from the file.
  const pick = featured(checks) as any;
  const v = rec.variants[pick.maker === 'A' ? 0 : 1];
  const text = (sel: string) => page.locator(sel).evaluateAll((els) => els.map((el) => [...el.querySelectorAll('[data-answer-line]')].map((line) => line.textContent).join('\n')));
  expect(await text('.made-up-answer [data-answer]')).toEqual([plain(v.runs[pick.run - 1].reply)]);
  if (pick.maker === 'B') await expect(shell.locator('article')).toContainText(`the model's default (${v.model.card.default_model_temperature}, read from Mistral on`);
  await page.locator('.made-up-runs summary').click();
  expect(await text('.made-up-runs [data-answer]')).toEqual(rec.variants.flatMap((x: any) => x.runs.map((r: any) => plain(r.reply))));
  for (const [i, x] of rec.variants.entries()) for (const [n, r] of x.runs.entries()) {
    const card = page.locator('.made-up-runs article').nth(i * 10 + n);
    await expect(card).toContainText((x.model ?? rec.model).id);
    await expect(card).toContainText(new Date(r.calls.at(-1).at).toLocaleString('en-IE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC');
    await expect(card).toContainText(String((x.settings ?? rec.settings).max_tokens.toLocaleString()));
    // T6: each check line starts with its verdict's fixed words, the values read from recorded.yaml.
    const shown = await card.locator('[data-check]').allTextContents();
    const fixed: string[] = checks[i * 10 + n].lines.map((l: any) => checkText(l));
    expect(same(shown, fixed)).toBe(true);
    if (i === 1 && n === 8) expect(same(shown, fixed.map((f, k) => (k === 1 ? f.replace('Checked', 'Found') : f)))).toBe(false); // known-bad
  }
  expect((await shell.locator('.picked, .after-pick').allTextContents()).join(' ')).not.toMatch(/\b\d+ (?:of|out of) \d+\b|%/);
});
// p6-15-review B3: every answer box wraps its text at a phone's width and a desktop's, so none scrolls sideways.
for (const width of [320, 390, 1280]) test(`no answer box scrolls sideways at ${width} px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL);
  const shell = page.locator('.made-up-answer');
  await shell.getByRole('radio', { name: 'Study 1' }).first().check();
  await shell.getByRole('radio', { name: 'They sound the same' }).check();
  await shell.locator('[data-reveal]').click();
  await page.locator('.made-up-runs summary').click();
  const boxes = page.locator('[data-answer]');
  expect(await boxes.count()).toBe(21);
  const wide = () => boxes.evaluateAll((els) => els.filter((el) => el.clientWidth === 0 || el.scrollWidth > el.clientWidth).length);
  expect(await wide()).toBe(0);
  await boxes.evaluateAll((els) => els.forEach((el) => el.querySelectorAll<HTMLElement>('[data-answer-line]').forEach((l) => l.style.setProperty('white-space', 'pre'))));
  expect(await wide()).toBeGreaterThan(0); // known-bad: a line that cannot wrap is caught
});
