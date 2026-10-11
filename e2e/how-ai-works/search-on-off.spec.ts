import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { markdownToMdast, type MdastNode } from 'satteri';
import { expect, test, type Page } from '../guard.ts';
import { checkShell } from '../shell.ts';
const url = '/learn/how-ai-works/where-your-question-goes/';
const rec = JSON.parse(readFileSync('data/recorded/R-1.5.json', 'utf8'));
const said = (load(readFileSync('content/how-ai-works/where-your-question-goes/recorded.yaml', 'utf8')) as any)['R-1.5'];
const area = (page: Page) => page.locator('.search-on-off');
// Every recorded word remains; Markdown punctuation is now represented by real HTML.
const words = (node: MdastNode): string => 'value' in node ? node.value : 'children' in node ? node.children.map(words).join('') : '';
const plain = (text: string) => words(markdownToMdast(text)).replace(/\s/g, '');
async function answer(card: ReturnType<Page['locator']>, run: any) {
  const shown = card.locator('[data-reply]');
  expect((await shown.textContent())?.replace(/\s/g, '')).toBe(plain(run.reply));
  await expect(shown.locator('strong')).toHaveCount(Math.floor(run.reply.split('**').length / 2));
  await expect(card.locator('.citations > li')).toHaveCount(run.citations.length);
  for (const [n, cite] of run.citations.entries()) {
    const item = card.locator('.citations > li').nth(n);
    for (const word of [cite.title, cite.url]) await expect(item).toContainText(word);
    expect((await item.locator('blockquote').textContent())?.replace(/\s/g, '')).toBe(plain(cite.cited_text));
  }
}
test('the shell shows exact answers, checked sources and every run', async ({ page }) => {
  await checkShell(page, url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const box = area(page);
  for (const word of [rec.model.name, rec.model.id, rec.model.host, rec.message, said.cutoff,
    new Date(rec.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })]) await expect(box).toContainText(word);
  for (const [i, variant] of rec.variants.entries()) await answer(box.locator('[data-pair]').first().locator('.replies > li').nth(i), variant.runs[0]);
  const reveal = box.getByRole('button', { name: 'Show what happened' });
  await expect(reveal).toBeDisabled(); expect(await box.locator('mark').first().evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
  await box.getByRole('radio', { name: 'Answer 2', exact: true }).check();
  await reveal.click(); expect(await box.locator('mark').first().evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
  for (const word of ['Answer 2 had search on', 'No run gave the 2026 final with a matching score.', said.truth.score, said.truth.previous]) await expect(box).toContainText(word);
  await box.getByRole('button', { name: 'Show another run' }).click();
  await expect(box.locator('[data-pair].current h3')).toBeFocused();
  await box.getByText('Show all runs').click();
  for (const [i, variant] of rec.variants.entries()) for (const [n, run] of variant.runs.entries()) {
    const card = box.locator('[data-pair]').nth(n).locator('.replies > li').nth(i);
    await answer(card, run);
    for (const word of [variant.settings.search, run.calls[0].response.model,
      new Date(run.calls[0].at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }), ...run.searches]) await expect(card).toContainText(word);
  }
  expect(await box.innerText()).not.toMatch(/\b\d+ (?:of|out of) \d+\b|%/);
  const first = box.locator('[data-pair]').first().locator('.replies > li').first().locator('[data-reply]');
  await first.evaluate(el => { el.textContent += 'x'; });
  await expect(answer(box.locator('[data-pair]').first().locator('.replies > li').first(), rec.variants[0].runs[0])).rejects.toThrow();
  const cited = box.locator('[data-pair]').first().locator('.replies > li').nth(1).locator('.citations > li');
  await cited.first().evaluate(el => el.remove());
  await expect(expect(cited).toHaveCount(rec.variants[1].runs[0].citations.length, { timeout: 200 })).rejects.toThrow();
});
test('the stored recording is untouched, and still holds the Markdown markers', () => {
  expect(createHash('sha256').update(readFileSync('data/recorded/R-1.5.json')).digest('hex')).toBe(said.recordingSha256);
  expect(rec.variants.flatMap((v: any) => v.runs).some((r: any) => r.reply.includes('**'))).toBe(true);
});
for (const width of [320, 390, 1280]) test(`no link in the exercise scrolls sideways at ${width} px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(url);
  await area(page).getByRole('radio', { name: 'Answer 2', exact: true }).check();
  await area(page).getByRole('button', { name: 'Show what happened' }).click();
  await area(page).getByText('Show all runs').click();
  const wide = await area(page).locator('a').evaluateAll((as) => as.filter((a) => a.scrollWidth > a.clientWidth).map((a) => a.textContent));
  expect(wide).toEqual([]);
});
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all answers and cited words remain readable', async ({ page }) => {
    await page.goto(url);
    for (const [i, variant] of rec.variants.entries()) for (const [n, run] of variant.runs.entries()) {
      const card = area(page).locator('[data-pair]').nth(n).locator('.replies > li').nth(i);
      await expect(card.locator('[data-reply]')).toBeVisible();
      await answer(card, run);
    }
    await expect(area(page).getByRole('button', { name: 'Show what happened' })).toBeHidden();
  });
});
