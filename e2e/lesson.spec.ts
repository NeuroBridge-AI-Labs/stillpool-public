// The lesson page (plan T6.1 and T6.4, D4): the anatomy in its planned order, and every Core section a heading with
// an anchor and its own depth group.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { pages } from '../checks/serve.ts';
import { final } from '../src/factcheck.ts';
import { expect, test } from './guard.ts';

const lessons = pages('dist').filter((route) => route.startsWith('/learn/'));
// D4's order. Try it and the take join each only when the lesson has one; the take is after the Check-in, or after In short
// (e2e/take.spec.ts), so it is left out of this list.
const ORDER = ['title', 'promise', 'time', 'tldr', 'core', 'tryit', 'checkin', 'sources', 'glossary', 'wherenext', 'badge', 'finish'];
const REQUIRED = ORDER.filter((part) => part !== 'glossary' && part !== 'tryit');

test('the anatomy parts appear in the planned order', async ({ page }) => {
  expect(lessons.length).toBeGreaterThan(0);
  for (const route of lessons) {
    await page.goto(route);
    const parts = (await page.locator('main [data-part]').evaluateAll((els) => els.map((el) => el.getAttribute('data-part')))).filter((part) => part !== 'take');
    expect(parts, route).toEqual(ORDER.filter((part) => parts.includes(part)));
    for (const part of REQUIRED) expect(parts, route).toContain(part);
    await expect(page.locator('[data-part="promise"]'), route).toHaveText(/^After this lesson you can [a-z].*\.$/);
    await expect(page.locator('[data-part="time"]'), route).toHaveText(/^About \d+ minutes, or \d+ with the Deep layers$/);
    await expect(page.locator('[data-part="tldr"] li'), route).toHaveCount(3);
  }
});

test('every Core section has a heading with a unique id and a depth group labelled with that heading', async ({ page }) => {
  for (const route of lessons) {
    await page.goto(route);
    // R6 SHOULD-FIX 1: no id repeats. The lesson's own ids start part-; the site's (main, settings) are caught here.
    const ids = await page.locator('[id]').evaluateAll((els) => els.map((el) => el.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), route).toEqual([]);
    const headings = await page.locator('[data-part="core"] > h2').all();
    expect(headings.length, route).toBeGreaterThan(0);
    for (const h of headings) {
      expect(await h.getAttribute('id'), route).toMatch(/^[a-z0-9-]+$/);
      const group = h.locator('xpath=following-sibling::*[1]');
      await expect(group, route).toHaveRole('group');
      await expect(group, route).toHaveAccessibleName(`Reading depth for ${(await h.textContent())?.trim()}`);
    }
  }
});

// D10 and p6 D5: the notice shows exactly until the lesson is final, as src/factcheck.ts's final() decides for the
// page and check:content alike (critic S4).
test('the notice shows exactly until the fact-check is final', async ({ page }) => {
  for (const route of lessons) {
    const id = route.split('/').slice(2, 4).join('/');
    const provisional = !final('content', id);
    await page.goto(route);
    const notice = page.getByText('This lesson is waiting for its independent fact-check. It is here for testing.', { exact: true });
    await expect(notice, route).toHaveCount(provisional ? 1 : 0);
  }
});

// p6-7-review S4: the Where next text (for 1.4, a different site, about 600 MB, nothing private) comes before its link, on the
// lesson and on its finish page (l14-fold-review F1).
test('the Where next text comes before its link', async ({ page }) => {
  for (const [route, part] of [['/learn/how-ai-works/the-next-word/', '[data-part="wherenext"]'], ['/done/how-ai-works/the-next-word/', '[aria-labelledby="done-next"]']]) {
    await page.goto(route);
    const where = page.locator(`${part} p`);
    await expect(where.first(), route).toContainText('Type nothing private there.');
    await expect(where.nth(1).getByRole('link'), route).toHaveText(/^Transformer Explainer/);
  }
});

// Design run 33, D1 (Emanuel, 28-09-26): a full-width line above every section heading, so a reader sees where one section
// ends. Pool Band v2 (04-10-26): not above the first Core section, which follows the In short card, nor above the activity,
// whose own card is its frame. Sources' line sits on its summary, which holds its heading. The take is a card too, and the
// first Core section after it (3.1, where it follows In short) takes no line either.
test('D1: a full-width line above every section heading but the card-framed ones, at 390 and 1280 wide', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of lessons) {
      await page.goto(route);
      const lines = await page.locator('main h2').evaluateAll((hs) =>
        hs.filter((h) => h.checkVisibility()).map((h) => {
          const el = h.closest('summary') ?? h;
          const s = getComputedStyle(el);
          const full = el.getBoundingClientRect().width >= document.querySelector('.article')!.clientWidth - 40;
          return [h.id, s.borderTopStyle === 'solid' && parseFloat(s.borderTopWidth) > 0 && full];
        }),
      );
      const cards = lines[1]?.[0] === 'part-take' ? 2 : 1;
      expect(lines, `${route} at ${width}`).toEqual(lines.map(([id], i) => [id, i > cards && id !== 'part-try-it' && id !== 'part-take']));
    }
  }
});

// D2: Sources is closed until opened, its summary is the heading with the count, and every source is still in the page.
test('D2: Sources is closed, says its count, keeps its heading and id, and holds every source', async ({ page }) => {
  for (const route of lessons) {
    const { sources } = load(readFileSync(`content/${route.split('/').slice(2, 4).join('/')}/index.mdx`, 'utf8').split('---')[1]) as {
      sources: { url?: string; title: string }[];
    };
    await page.goto(route);
    const part = page.locator('[data-part="sources"]');
    await expect(part.locator('details'), route).not.toHaveAttribute('open');
    await expect(part.locator('summary > h2#part-sources'), route).toHaveText(`Sources (${sources.length})`);
    await expect(part, route).toHaveAccessibleName(`Sources (${sources.length})`);
    expect(await part.locator('li a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.textContent?.replace(' (opens in a new tab)', '')])), route).toEqual(
      sources.flatMap((s) => (s.url ? [[s.url, s.title]] : [])),
    );
    for (const s of sources.filter((x) => !x.url)) await expect(part.locator('li', { hasText: `${s.title} (not published)` }), route).toHaveCount(1);
    await part.locator('summary').click();
    await expect(part.locator('li a').last(), route).toBeVisible();
  }
});

// D3: in Pillar 1, each piece and its chance (1.4) or its ID (1.3) sit in one box, the boxes in reading order with a
// clear gap, so no number can be read as its neighbour's.
test('D3: each piece and its number share one box, in reading order, with a gap between boxes', async ({ page }) => {
  const LISTS = [
    ['/learn/how-ai-works/the-next-word/', '.next-word .reply'],
    ['/learn/how-ai-works/tokens/', '.token-splitter .pieces[data-item]'],
  ];
  for (const width of [390, 1280])
    for (const [route, list] of LISTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      if (route.includes('next-word')) await page.getByRole('button', { name: 'Show me without guessing' }).click();
      else {
        for (const n of await page.locator('.token-splitter fieldset[data-step] input[type=number]').all()) await n.fill('2');
        await page.locator('.token-splitter [data-reveal]').click();
      }
      for (const ol of await page.locator(list).all()) {
        const boxes = await ol.locator(':scope > li').evaluateAll((lis) =>
          lis.map((li) => {
            const r = li.getBoundingClientRect();
            const s = getComputedStyle(li);
            const shown = [...li.children].filter((c) => c.getAttribute('aria-hidden') === 'true');
            const inside = shown.every((c) => ((q) => q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom)(c.getBoundingClientRect()));
            return { r: [r.left, r.top, r.right, r.bottom], boxed: s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0 && shown.length === 2 && inside };
          }),
        );
        expect(boxes.length, route).toBeGreaterThan(0);
        expect(boxes.filter((b) => !b.boxed), `${route} at ${width}: a piece or its number outside its box`).toEqual([]);
        const [cramped] = boxes.slice(1).flatMap(({ r: [l, t] }, i) => {
          const [, pt, pr, pb] = boxes[i].r;
          return (Math.abs(t - pt) < 1 ? l - pr : t - pb) >= 8 ? [] : [[i, i + 1]];
        });
        expect(cramped, `${route} at ${width}: boxes out of order or closer than 8 px`).toBeUndefined();
      }
    }
});
