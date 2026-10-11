// The contents (Emanuel, 27-09-26): all 41 signed lessons under their five pillars, like a book's contents, each pillar
// its own disclosure. A lesson with a folder is a link; the rest say "coming later". Pool Band v2 (04-10-26): one closed
// Course contents disclosure under the map on every screen, and the lesson's rail on a lesson, the course contents closed in it. The expected rows are read here with their own
// regex, not the site's parser.
import { globSync, readFileSync } from 'node:fs';
import axe from 'axe-core';
import { expect, test, type Page } from './guard.ts';

const signed = readFileSync('docs/curriculum/lesson-list.md', 'utf8').split('## 📋 The 41 lessons')[1].split('\n## ')[0];
const rows = [...signed.matchAll(/^\| (\d+\.\d+) \| ([^|]+?) \|/gm)].map(([, n, title]) => `${n} ${title}`);
const built = globSync('content/*/*/index.mdx').map((f) => `/learn/${f.split('/').slice(1, 3).join('/')}/`);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Contents' });
// The one disclosure that holds all five pillars.
const all = (page: Page) => nav(page).locator('.toc-all > summary');
const course = (page: Page) => nav(page).locator('.course > summary');
const LAPTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

test('the contents show all 41 signed lessons under five pillars', async ({ page }) => {
  expect(rows).toHaveLength(41);
  await page.setViewportSize(LAPTOP);
  await page.goto('/');
  await expect(nav(page).locator('details.pillar > summary')).toHaveCount(5);
  const items = await nav(page).locator('ol li').evaluateAll((lis) => lis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim()));
  expect(items.map((t) => t?.replace(/ coming later$/, ''))).toEqual(rows);
});

test('1.1 links to its lesson, and a lesson with no folder is not a link and says coming later', async ({ page }) => {
  await page.goto('/');
  await all(page).click();
  await expect(nav(page).getByRole('link', { name: '1.1 What AI is and is not' })).toHaveAttribute('href', '/learn/how-ai-works/what-ai-is-and-is-not/');
  // Every link, closed pillars included: a closed disclosure hides its links from getByRole.
  const links = await nav(page).locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(links.sort()).toEqual(built.sort());
  // Every lesson is built now, so none says "coming later". The branch is held as a rule that still binds if a folder goes: a row is a link
  // or says coming later, never both or neither, and exactly as many rows as have no folder are not links.
  const rowsSeen = await nav(page).locator('ol li').evaluateAll((lis) => lis.map((li) => ({ link: !!li.querySelector('a'), later: !!li.textContent?.includes('coming later') })));
  expect(rowsSeen.filter(({ link, later }) => link === later)).toEqual([]);
  expect(rowsSeen.filter(({ link }) => !link)).toHaveLength(rows.length - built.length);
});

test('the course contents are one closed disclosure under the map, pillar 1 open inside, on a laptop and on a phone', async ({ page }) => {
  for (const size of [LAPTOP, PHONE]) {
    await page.setViewportSize(size);
    await page.goto('/');
    const summary = all(page);
    await expect(summary, `${size.width}`).toBeVisible();
    await expect(nav(page).getByRole('link').first(), `${size.width} closed`).toBeHidden();
    const [contents, map] = await Promise.all([nav(page).boundingBox(), page.locator('.map').boundingBox()]);
    expect(contents!.y, `under the map at ${size.width}`).toBeGreaterThanOrEqual(map!.y + map!.height);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(nav(page).getByRole('link').first()).toBeVisible();
    expect(await nav(page).locator('details.pillar').evaluateAll((ds) => ds.map((d) => (d as HTMLDetailsElement).open))).toEqual([true, false, false, false, false]);
    await page.keyboard.press('Tab'); // pillar 1's summary
    await page.keyboard.press('Tab');
    await expect(nav(page).getByRole('link').first()).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  }
});

test('nothing scrolls sideways with the largest text and the widest font, on a laptop or a phone', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ size: '5', font: 'opendyslexic', spacing: 'wider' })));
  for (const size of [LAPTOP, PHONE]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await all(page).click();
    await expect(nav(page).getByRole('link').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `at ${size.width}`).toBeLessThanOrEqual(size.width);
  }
});

// Four themes: the three named ones, and Same as my device, here resolving to dark.
for (const theme of ['light', 'dark', 'contrast', 'device'])
  test(`no axe violation on / in the ${theme} theme, on a laptop and on a phone, with the contents open`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'device' ? 'dark' : 'light' });
    await page.addInitScript((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    for (const size of [LAPTOP, PHONE]) {
      await page.setViewportSize(size);
      await page.goto('/');
      await all(page).click();
      await page.evaluate(axe.source);
      const found = await page.evaluate(() =>
        axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }),
      );
      expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), `${theme} at ${size.width}`).toEqual([]);
    }
  });

// Design polish D2 (Emanuel, 27-09-26): each pillar is a native disclosure, opened and closed on its own.
test('a pillar opens and closes by Enter and by Space', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await all(page).click();
  const pillar = nav(page).locator('details.pillar').nth(1);
  await pillar.locator('summary').focus();
  for (const key of ['Enter', 'Enter', 'Space', 'Space']) {
    const was = await pillar.evaluate((d) => (d as HTMLDetailsElement).open);
    await page.keyboard.press(key);
    await expect(pillar, key).toHaveJSProperty('open', !was);
  }
});

test('on a lesson at 1440 the rail is a sidebar that stays in view, and its course contents mark the lesson as the current page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/learn/how-ai-works/rules-or-examples/');
  await course(page).click();
  const current = nav(page).locator('a[aria-current="page"]');
  await expect(current).toHaveText('1.2 Rules or examples?');
  await expect(current).toBeVisible();
  await page.evaluate(() => scrollTo(0, 2000));
  await expect(current, 'still in view after scrolling').toBeInViewport();
  const [side, article] = await Promise.all([nav(page).boundingBox(), page.locator('.article').boundingBox()]);
  expect(side!.x + side!.width, 'left of the lesson').toBeLessThanOrEqual(article!.x);
});

test('with the two largest text sizes, on a laptop, the contents on / are one closed disclosure', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  for (const size of ['4', '5']) {
    await page.addInitScript((s) => localStorage.setItem('nbl:settings', JSON.stringify({ size: s })), size);
    await page.goto('/');
    await expect(all(page), size).toBeVisible();
    await expect(nav(page).getByRole('link').first(), size).toBeHidden();
  }
});

// design-review S2: the sidebar is its own landmark before main, so the skip link lands on the lesson, not the contents.
test('on a lesson at 1440, one Tab after the skip link reaches the lesson column, never the contents', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/learn/how-ai-works/rules-or-examples/');
  expect(await nav(page).evaluate((n) => !!n.closest('main')), 'the contents outside main').toBe(false);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Skip to main content');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const at = await page.evaluate(() => ({ column: !!document.activeElement?.closest('main'), contents: !!document.activeElement?.closest('.toc') }));
  expect(at).toEqual({ column: true, contents: false });
});
