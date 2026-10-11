// The checks every static Pillar 3 "cases" activity shares (src/components/Cases.astro), on the site build: the shell's five
// checks, the first guess before its answer, each later case only after the one before, the whole task by keyboard, text
// and no-JavaScript versions, and no score. Each activity's own spec adds what is special to it.
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

export const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
export const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show the answer' }).first();
// Case 0 sits in the shell's first step; case k is the k-th [data-case] section.
const field = (page: Page, k: number) => (k ? tryIt(page).locator('[data-case]').nth(k) : tryIt(page).locator('[data-step]').first());
// A scene is looked up inside its own case, as two cases may share one (4.4: "Same small print as above.").
const sceneOf = (page: Page, k: number, scene: string) => field(page, k).getByText(scene, { exact: true });
export const pick = (page: Page, k: number, name: string) => field(page, k).getByRole('radio', { name, exact: true });
// Pick an option: a radio, or a select when `options` is set (more than five choices), with the mouse or by keys.
export async function choose(page: Page, k: number, name: string, c: { options?: string[] }, byKey = false) {
  if (!c.options) {
    if (!byKey) return pick(page, k, name).check();
    await pick(page, k, name).focus();
    return page.keyboard.press('Space');
  }
  const select = field(page, k).getByRole('combobox');
  if (!byKey) return void (await select.selectOption({ label: name }));
  await select.focus();
  await page.keyboard.type(name); // type-ahead: an arrow key opens the list on a Mac
}
export const showFor = (page: Page, k: number) => tryIt(page).locator('[data-case]').nth(k).getByRole('button', { name: 'Show the answer' });
export const answerOf = (page: Page, k: number) => tryIt(page).locator('[data-case]').nth(k).locator('.case-answer');
// A real Tab walk (t4 C11): press Tab until focus is in the target, never focus() it, so a control taken out of the tab order fails.
type Locator = ReturnType<Page['locator']>;
async function tabTo(page: Page, target: Locator) {
  for (let n = 0; n < 80; n++) {
    await page.keyboard.press('Tab');
    if (await target.first().evaluate((el) => el.contains(document.activeElement))) return;
  }
  throw new Error(`Tab never reached ${target}`);
}
export const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak)\b|\b\d+ points\b/i;

export type Cases = {
  lesson: string;
  picks: string[]; // the option to pick in each case, in order
  scenes: string[]; // each case's scene, exactly
  answers: string[]; // text only the case's answer holds
  options?: string[]; // the choices, when they are a select
  score?: RegExp; // what no case may say; SCORE unless an activity quotes a sourced figure (4.5)
};

export async function answerAll(page: Page, c: Cases) {
  const { picks } = c;
  await choose(page, 0, picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < picks.length; k++) {
    await choose(page, k, picks[k], c);
    await showFor(page, k).click();
  }
}

export function caseChecks(c: Cases) {
  const { lesson, picks, scenes, answers } = c;
  const body = (page: Page) => tryIt(page).innerText();

  test("the shell's five checks", ({ page }) => checkShell(page, lesson));

  test('predict first: the answer waits for the pick and the reveal, and the pick is said', async ({ page }) => {
    await page.goto(lesson);
    await expect(sceneOf(page, 0, scenes[0])).toBeVisible();
    await expect(answerOf(page, 0)).toBeHidden();
    await expect(reveal(page)).toBeDisabled();
    await choose(page, 0, picks[0], c);
    await expect(reveal(page)).toBeEnabled();
    await reveal(page).click();
    await expect(tryIt(page).locator('.picked')).toBeFocused();
    await expect(tryIt(page).locator('.picked')).toHaveText(`You picked: ${picks[0]}`);
    await expect(answerOf(page, 0)).toContainText(answers[0]);
    await expect(answerOf(page, 0)).toBeVisible();
  });

  test('one case at a time: each next case waits for the answer before it, and its answer for its own pick', async ({ page }) => {
    await page.goto(lesson);
    await choose(page, 0, picks[0], c);
    await reveal(page).click();
    for (let k = 1; k < scenes.length; k++) {
      await expect(sceneOf(page, k, scenes[k])).toBeVisible();
      if (k + 1 < scenes.length) await expect(sceneOf(page, k + 1, scenes[k + 1])).toBeHidden();
      await expect(answerOf(page, k)).toBeHidden();
      await expect(showFor(page, k)).toBeDisabled();
      await choose(page, k, picks[k], c);
      await expect(showFor(page, k)).toBeEnabled();
      await showFor(page, k).click();
      await expect(answerOf(page, k)).toBeFocused();
      await expect(answerOf(page, k)).toContainText(`You picked: ${picks[k]}`);
      await expect(answerOf(page, k)).toContainText(answers[k]);
    }
    expect(await body(page)).not.toMatch(c.score ?? SCORE);
  });

  test('the whole task works by keyboard alone: Tab from the text switch to every pick, reveal and design change', async ({ page }) => {
    await page.goto(lesson);
    await tryIt(page).getByLabel('Read it as text instead').focus();
    for (let k = 0; k < picks.length; k++) {
      const where = field(page, k);
      if (c.options) {
        await tabTo(page, where.getByRole('combobox'));
        await page.keyboard.type(picks[k]); // type-ahead: an arrow key opens the list on a Mac
      } else {
        const names = await where.getByRole('radio').evaluateAll((rs) => rs.map((r) => r.closest('label')?.textContent?.trim()));
        await tabTo(page, where.getByRole('radio').first());
        const at = names.indexOf(picks[k]);
        if (at) for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown'); // each arrow moves to the next radio and picks it
        else await page.keyboard.press('Space');
      }
      await tabTo(page, k ? showFor(page, k) : reveal(page));
      await page.keyboard.press('Enter');
      await expect(answerOf(page, k)).toContainText(answers[k]);
      const change = answerOf(page, k).getByRole('button', { name: 'Make this change' });
      if (await change.count()) {
        await tabTo(page, change);
        await page.keyboard.press('Enter');
        await expect(answerOf(page, k).locator('[data-moves]')).toBeFocused();
      }
    }
  });

  test('"Show interactives as text" writes every case and every answer out, with nothing to press', async ({ page }) => {
    await page.goto(lesson);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    for (const [k, scene] of scenes.entries()) {
      await expect(sceneOf(page, k, scene)).toBeVisible();
      await expect(answerOf(page, k)).toBeVisible();
      await expect(answerOf(page, k)).toContainText(answers[k]);
    }
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(tryIt(page).getByRole('combobox')).toBeHidden();
    await expect(tryIt(page).getByRole('button', { name: /Show the answer|Make this change/ })).toBeHidden();
    for (const moves of await tryIt(page).locator('[data-moves]').all()) await expect(moves).toBeVisible(); // t4 C12
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every case and every answer is written out', async ({ page }) => {
      await page.goto(lesson);
      for (const [k, scene] of scenes.entries()) {
        await expect(sceneOf(page, k, scene)).toBeVisible();
        await expect(answerOf(page, k)).toBeVisible();
        await expect(answerOf(page, k)).toContainText(answers[k]);
      }
      await expect(reveal(page)).toBeHidden();
      await expect(tryIt(page).getByRole('radio')).toBeHidden();
      await expect(tryIt(page).getByRole('combobox')).toBeHidden();
      await expect(tryIt(page).getByRole('button', { name: /Show the answer|Make this change/ })).toBeHidden();
      for (const moves of await tryIt(page).locator('[data-moves]').all()) await expect(moves).toBeVisible(); // t4 C12
    });
  });

  test('at 320 px nothing scrolls sideways, before and after the answers', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(lesson);
    const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await flat()).toBe(true);
    await answerAll(page, c);
    expect(await flat()).toBe(true);
  });

  // 3.5 and 3.6 review: the answer boxes nest insets, so a long legal word was cut in two on a narrow phone.
  test('with OpenDyslexic, Wider spacing and Largest text a finished answer keeps every word that fits the text column whole at 320 and 360 px', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ font: 'opendyslexic', spacing: 'wider', size: '5' })));
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(lesson);
      await page.evaluate(() => document.fonts.ready);
      await answerAll(page, c);
      const split = await page.evaluate(() => {
        const found: string[] = [];
        const walk = document.createTreeWalker(document.querySelector('[data-part="tryit"]') as Node, NodeFilter.SHOW_TEXT);
        for (let node = walk.nextNode(); node; node = walk.nextNode())
          for (const word of (node.textContent ?? '').matchAll(/[^\s/-]+/g)) {
            if (/[\d:]/.test(word[0])) continue; // an identifier such as ECLI:NL:RBDHA:2020:1878 may wrap
            const range = document.createRange();
            range.setStart(node, word.index);
            range.setEnd(node, word.index + word[0].length);
            const pieces = [...range.getClientRects()];
            if (new Set(pieces.map((r) => Math.round(r.top))).size < 2) continue;
            // A word wider than the page's whole text column may break (WCAG 1.4.10, reflow); one that fits the column must
            // stay whole, however deep the answer box sits in it (t2 C3: the old test measured the box, not the column).
            const line = (document.querySelector('.article') as HTMLElement).clientWidth; // the lesson's text column
            if (pieces.reduce((sum, r) => sum + r.width, 0) <= line) found.push(word[0]);
          }
        return found;
      });
      expect(split, `${lesson} at ${width}`).toEqual([]);
    }
  });
}
