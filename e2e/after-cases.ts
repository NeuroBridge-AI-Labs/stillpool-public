// The recorded part after the cases (Pillar 4: 4.1, 4.6), on the fixture build: it waits for the last answer, then holds the
// summary, the AIs and every run with its marks. It sits beside the Try it section, not in it (Cases has no slot for it).
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { answerOf, type Cases, choose, reveal, showFor } from './cases.ts';
import { expect, type Page, test } from './guard.ts';
import { fixture } from './p2.ts';

export const after = (page: Page) => page.locator('[data-after-cases]');
type Mark = { variant: string; maker: string; run: number; note: string; falseText?: string; reason?: string };

// Every run of the recording is behind "Show all runs", each with its notes, its marked pieces and their reasons.
export async function checkRuns(page: Page, id: string) {
  const rec = fixture(id);
  const marks = (load(readFileSync('fixtures/recorded/recorded.yaml', 'utf8')) as Record<string, { marks: Mark[] }>)[id].marks;
  const cards = after(page).locator('.all-runs [data-key]');
  const keys = rec.variants.flatMap((v) => v.runs.map((_, i) => `${v.label}|${v.maker}|${i + 1}`));
  expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).sort())).toEqual(keys.sort());
  for (const v of rec.variants)
    for (const [i, run] of v.runs.entries()) {
      const card = after(page).locator(`.all-runs [data-key="${v.label}|${v.maker}|${i + 1}"]`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(run.reply);
      const own = marks.filter((m) => m.variant === v.label && m.maker === v.maker && m.run === i + 1);
      await expect(card.locator('mark')).toHaveText(own.flatMap((m) => (m.falseText ? [m.falseText] : [])));
      for (const m of own) {
        await expect(card).toContainText(m.note);
        if (m.reason) await expect(card).toContainText(`Not true: ${m.reason}`);
      }
    }
}

// The part is hidden until the last case has its answer, and written out as text and without JavaScript.
export function afterChecks(c: Cases, id: string, labels: string[]) {
  test('the summary and the runs wait for the last answer, then show the AIs, the day, the settings and every run', async ({ page }) => {
    await page.goto(c.lesson);
    await expect(after(page)).toBeHidden();
    await choose(page, 0, c.picks[0], c);
    await reveal(page).click();
    for (let k = 1; k < c.picks.length; k++) {
      await expect(after(page)).toBeHidden();
      await choose(page, k, c.picks[k], c);
      await showFor(page, k).click();
      await expect(answerOf(page, k)).toBeFocused();
    }
    await expect(after(page)).toBeVisible();
    const said = await after(page).innerText();
    expect(said).toContain(`Test fixture summary of ${id}, first paragraph.`);
    expect(said).toContain(fixture(id).model.name);
    expect(said).toContain('Recorded on 1 January 2000');
    expect(said).toContain('Longest answer, in tokens: 4000');
    expect(said).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak|points)\b/i);
    await after(page).locator('.all-runs summary').focus();
    await page.keyboard.press('Enter');
    await checkRuns(page, id);
    for (const l of labels) await expect(after(page).locator('.all-runs h3', { hasText: l })).toBeVisible();
  });
  test('as text the summary and every run are written out', async ({ page }) => {
    await page.goto(c.lesson);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    await expect(after(page)).toContainText(`Test fixture summary of ${id}, second paragraph.`);
    await checkRuns(page, id);
  });
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('the summary and every run are written out', async ({ page }) => {
      await page.goto(c.lesson);
      await expect(after(page)).toContainText(`Test fixture summary of ${id}, second paragraph.`);
      await checkRuns(page, id);
    });
  });
}
