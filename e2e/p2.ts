// The checks every stage I activity (Pillar 2) shares, run on the fixture build (dist-fixture, RECORDED_FIXTURE=1):
// the shell's five checks, predict then reveal, every run behind "Show all runs", the text version, no JavaScript, and
// no score. Each activity's own spec adds what is special to it.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

export type Rec = { model: { name: string }; variants: { label: string; maker: 'A' | 'B'; runs: { reply: string; replies?: string[] }[] }[] };
// n is a Pillar 2 recording number, or a whole id such as 'R-3.1'.
const idOf = (n: number | string) => (typeof n === 'string' ? n : `R-2.${n}`);
export const fixture = (n: number | string): Rec => JSON.parse(readFileSync(`fixtures/recorded/${idOf(n)}.json`, 'utf8'));
export const reply = (rec: Rec, label: string, maker: 'A' | 'B', run: number) => {
  const r = rec.variants.find((v) => v.label === label && v.maker === maker)!.runs[run - 1];
  return r.reply;
};
type Mark = { variant: string; maker: 'A' | 'B'; run: number; note: string; falseText?: string; reason?: string };
const marksOf = (n: number | string): Mark[] => (load(readFileSync('fixtures/recorded/recorded.yaml', 'utf8')) as Record<string, { marks?: Mark[] }>)[idOf(n)].marks ?? [];
export const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
export const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show what happened' });
// A pick is a radio's own name, or `group|name` when two questions offer the same words.
export const radio = (page: Page, pick: string) => {
  const [group, name] = pick.includes('|') ? pick.split('|') : [undefined, pick];
  return group ? tryIt(page).locator(`label:has(input[name="${group}"])`).filter({ hasText: name }).getByRole('radio') : tryIt(page).getByRole('radio', { name, exact: true });
};
export const allRuns = (page: Page) => tryIt(page).locator('.all-runs');
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak|points)\b/i;

export type P2 = {
  lesson: string;
  n: number | string; // the recording, R-2.<n> or a whole id
  picks: string[]; // the names of the radios to pick, one per question
  before: string[]; // replies in view before the reveal
  after: string[]; // replies that wait for the reveal
  said?: string; // what the live message holds after the reveal (default: the picks, in words)
  score?: RegExp; // what must not appear (default SCORE); 4.8 allows "key points", which SCORE reads as points won
};

// Every run of the recording, and every mark of every run, is in "Show all runs": the exact set of runs, each reply, each
// note, each highlighted false piece with its reason.
export async function checkEvery(page: Page, n: number | string) {
  const rec = fixture(n);
  const marks = marksOf(n);
  const keys = rec.variants.flatMap((v) => v.runs.map((_, i) => `${v.label}|${v.maker}|${i + 1}`));
  expect(await allRuns(page).locator('[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).sort())).toEqual(keys.sort());
  for (const v of rec.variants) {
    for (const [i, run] of v.runs.entries()) {
      const card = allRuns(page).locator(`[data-key="${v.label}|${v.maker}|${i + 1}"]`);
      await expect(card).toBeVisible();
      for (const turn of run.replies ?? [run.reply]) await expect(card).toContainText(turn);
      const own = marks.filter((m) => m.variant === v.label && m.maker === v.maker && m.run === i + 1);
      const said = (run.replies ?? [run.reply]).join('\n');
      const shown = own.filter((m) => m.falseText);
      await expect(card.locator('mark')).toHaveText(shown.map((m) => m.falseText!).sort((a, b) => said.indexOf(a) - said.indexOf(b)));
      for (const m of own) {
        await expect(card).toContainText(m.note);
        if (m.reason) await expect(card).toContainText(`Not true: ${m.reason}`);
      }
    }
  }
}

export function p2Checks({ lesson, n, picks, before, after, said: live = 'you said', score = SCORE }: P2) {
  const rec = fixture(n);
  const pickAll = async (page: Page) => {
    for (const name of picks) await radio(page, name).check();
  };

  test('the shell\'s five checks', ({ page }) => checkShell(page, lesson));

  test('predict first: the reveal waits for every pick, and the answers wait for the reveal', async ({ page }) => {
    await page.goto(lesson);
    for (const t of before) await expect(tryIt(page).getByText(t, { exact: true }).first()).toBeVisible();
    for (const t of after) await expect(tryIt(page).getByText(t, { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(reveal(page)).toBeDisabled();
    for (const name of picks.slice(0, -1)) await radio(page, name).check();
    await expect(reveal(page)).toBeDisabled();
    await radio(page, picks.at(-1)!).check();
    await expect(reveal(page)).toBeEnabled();
    await reveal(page).click();
    await expect(tryIt(page).locator('.picked')).toBeFocused();
    await expect(tryIt(page).locator('.picked')).toContainText(live);
    for (const t of after) await expect(tryIt(page).getByText(t, { exact: true }).first()).toBeVisible();
    const said = await tryIt(page).innerText();
    expect(said).toContain(rec.model.name);
    expect(said).toContain('Recorded on 1 January 2000');
    expect(said).toContain('Longest answer, in tokens: 4000');
    expect(said).toContain('Test fixture summary of');
    expect(said).not.toMatch(score);
  });

  test('the whole task works by keyboard, and "Show all runs" holds every recorded run', async ({ page }) => {
    await page.goto(lesson);
    for (const name of picks) {
      await radio(page, name).focus();
      await page.keyboard.press('Space');
    }
    await reveal(page).focus();
    await page.keyboard.press('Enter');
    await expect(tryIt(page).locator('.picked')).toBeFocused();
    await allRuns(page).locator('summary').focus();
    await page.keyboard.press('Enter');
    await checkEvery(page, n);
  });

  test('"Show interactives as text" shows every step and every run, with nothing to press', async ({ page }) => {
    await page.goto(lesson);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    await checkEvery(page, n);
    await expect(tryIt(page).locator('.runs-pair .as-text').first()).toBeVisible(); // the slots are empty, and say where the runs are
    await expect(tryIt(page).locator('.runs-pair:has(.slot) article')).toHaveCount(0);
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(reveal(page)).toBeHidden();
    await expect(tryIt(page).locator('[data-again]:visible')).toHaveCount(0);
  });

  test('"Show interactives as text" switched on after the page loads empties the slots, and off brings them back', async ({ page }) => {
    await page.goto(lesson);
    await pickAll(page);
    await reveal(page).click();
    const slotted = tryIt(page).locator('.runs-pair:has(.slot) article');
    expect(await slotted.count()).toBeGreaterThan(0);
    await tryIt(page).locator('.shell-text input').check();
    await expect(slotted).toHaveCount(0);
    await checkEvery(page, n);
    await tryIt(page).locator('.shell-text input').uncheck();
    expect(await slotted.count()).toBeGreaterThan(0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every run and every step is written out', async ({ page }) => {
      await page.goto(lesson);
      await checkEvery(page, n);
      await expect(reveal(page)).toBeHidden();
    });
  });

  test('at 320 px nothing scrolls sideways, before and after the reveal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(lesson);
    const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await flat()).toBe(true);
    await pickAll(page);
    await reveal(page).click();
    expect(await flat()).toBe(true);
  });
}
