// Badges and Hide my progress (plan T8.2 to T8.4; spec 7): a badge shows only once earned, with no count and no empty
// slot; earning it is one quiet line; the switch hides every state, badge and celebration; Delete asks in the page.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { pages } from '../checks/serve.ts';
import { expect, type Page, test } from './guard.ts';

const routes = pages('dist');
const lesson = routes.find((route) => route.startsWith('/learn/')) as string;
const id = lesson.split('/').slice(2, 4).join('/');
const front = load(readFileSync(`content/${id}/index.mdx`, 'utf8').split('---')[1]) as { promise: string; badge: { celebration: string } };
// Right answers every question (a badge may need them all); wrong answers the first question only.
const answer = async (page: Page, right: boolean) => {
  const options = page.locator(`.question details${right ? '[data-right]' : ':not([data-right])'}`);
  for (const option of right ? await options.all() : [options.first()]) {
    await option.locator('summary').click();
    await expect(option.locator('xpath=..').locator('[aria-live]')).not.toBeEmpty();
  }
};
const earn = async (page: Page) => {
  await page.goto(lesson);
  await answer(page, true);
};

test('the badge appears only after every earnedBy step, and What you can do shows it with no count or empty slot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What you can do' })).toBeHidden();
  await page.goto(lesson);
  const badge = page.locator('[data-part="badge"]');
  await expect(badge).toBeHidden();
  await answer(page, false);
  await expect(badge).toBeHidden();
  await answer(page, true);
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(front.promise);
  await page.goto('/');
  const canDo = page.locator('main .can-do');
  await expect(page.getByRole('heading', { name: 'What you can do' })).toBeVisible();
  // One emblem and its promise, under the lesson's title (Pool Band v2); the pillar's branch is not a badge.
  const items = await canDo.locator('.item').evaluateAll((all) => all.filter((li) => li.checkVisibility()).map((li) => li.querySelector('p')?.lastChild?.textContent?.trim()));
  expect(items).toEqual([front.promise]);
  expect(await canDo.innerText()).not.toMatch(/\d/);
});

test('with Reduce motion on, earning it starts no animation, audio or canvas, and the live region holds the celebration line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Count starts, not just playing media: audio that starts and pauses again during the click would pass a paused check.
  await page.addInitScript(() => {
    const starts = { count: 0 };
    Object.assign(window, { mediaStarts: starts });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      starts.count++;
      return play.apply(this, args);
    };
    document.addEventListener('play', () => starts.count++, true);
  });
  await earn(page);
  await expect(page.locator('.celebration[aria-live="polite"]')).toHaveText(front.badge.celebration);
  // Emma's idle players are <audio> on the page: none may be playing.
  expect(
    await page.evaluate(() => [
      document.getAnimations().length,
      [...document.querySelectorAll<HTMLMediaElement>('audio, video')].filter((m) => !m.paused).length,
      document.querySelectorAll('canvas').length,
      (window as unknown as { mediaStarts: { count: number } }).mediaStarts.count,
    ]),
  ).toEqual([0, 0, 0, 0]);
});

// Pool Band v2 (04-10-26): the emblem is drawn once, in the badge frame, when the badge is earned; it never repeats, never
// loops, and Focus mode leaves it finished.
test('earning it draws the emblem once, inside the badge, and a reload or a later visit never draws it again', async ({ page }) => {
  await page.goto(lesson);
  await answer(page, true);
  const animations = () => page.evaluate(() => document.getAnimations().map((a) => [(a.effect as KeyframeEffect).target?.closest('.badge-frame') !== null, a.effect?.getComputedTiming().iterations]));
  const drawn = await animations();
  expect(drawn.length, 'the emblem is drawn').toBeGreaterThan(0);
  expect(drawn.every(([inside, iterations]) => inside && iterations === 1), 'inside the badge, never looping').toBe(true);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  await expect(page.locator('.badge-frame')).not.toHaveClass(/playing/);
  await page.reload();
  expect(await animations(), 'a reload shows it finished').toEqual([]);
});

test('Focus mode earns the badge with no drawing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ focus: 'on' })));
  await earn(page);
  await expect(page.locator('.badge-frame')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('Hide my progress hides states, badges and the celebration on every page and survives a reload', async ({ page }) => {
  await page.goto(`/done/${id}/`);
  await page.locator('main').getByLabel('Hide my progress').check();
  // Hide first, then earn: the line is written and still hidden (pr8-review SHOULD-FIX 2).
  await earn(page);
  await expect(page.locator('.celebration')).toHaveText(front.badge.celebration);
  await expect(page.locator('.celebration')).toBeHidden();
  await expect(page.locator('.earned-note'), 'the whole note goes, with its link and frame').toBeHidden();
  await expect(page.locator('.to-badge')).toBeHidden();
  for (const route of routes)
    for (const pass of ['load', 'reload']) {
      await page.goto(route);
      if (pass === 'reload') await page.reload();
      const shown = await page.locator('.state, [data-part="badge"], .can-do, .earned-note').evaluateAll((els) =>
        els.filter((el) => el.checkVisibility() && (el as HTMLElement).innerText.trim()).map((el) => el.outerHTML.slice(0, 60)),
      );
      expect(shown, `${route} ${pass}`).toEqual([]);
    }
});

test('Delete asks once in the page, then clears states and badges; Cancel keeps them', async ({ page }) => {
  await earn(page);
  await page.goto(`/done/${id}/`);
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('nbl:progress') ?? 'null'));
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  const ask = dialog.getByRole('button', { name: 'Delete my progress on this device' });
  await ask.click();
  await expect(dialog.getByRole('button', { name: 'Cancel' }), 'the safe choice has focus').toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask, 'focus comes back, never lost with a hidden button').toBeFocused();
  expect(await stored()).toMatchObject({ finished: [id], badges: [id] });
  await ask.click();
  await dialog.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(ask).toBeFocused();
  await expect(dialog.locator('.restored')).toHaveText('Your progress on this device is deleted.');
  expect(await stored(), 'pr8-review SHOULD-FIX 1: the key itself is gone').toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.locator(`main li[data-lesson="${id}"] .state`)).toHaveText('Not yet');
  await expect(page.getByRole('heading', { name: 'What you can do' })).toBeHidden();
  await page.goto(lesson);
  expect(await stored(), 'and stays gone on the next page').toBeNull();
});

// Fix round 1 (S3): hiding progress after earning hides the note and its link too, and showing it again brings them back.
test('hiding progress after earning hides the earning note and its link, and nothing earned is lost', async ({ page }) => {
  await earn(page);
  await expect(page.locator('.earned-note')).toBeVisible();
  await expect(page.locator('.to-badge')).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  await dialog.getByLabel('Hide my progress').check();
  await expect(page.locator('.earned-note')).toBeHidden();
  await expect(page.locator('.to-badge')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nbl:progress') ?? 'null'))).toMatchObject({ badges: [id] });
  await dialog.getByLabel('Hide my progress').uncheck();
  await expect(page.locator('.earned-note')).toBeVisible();
});
