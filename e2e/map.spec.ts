// The map on / (plan T5.3 and T5.4, D9; spec 3.1 and 7): every lesson under its pillar and topic from content/map.yaml,
// five or fewer to a topic, every node a link with a text label, nothing locked, and the map's own Hide my progress
// switch.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from './guard.ts';

type Pillar = { id: string; title: string; topics: { title: string; lessons: string[] }[] };
const pillars = load(readFileSync('content/map.yaml', 'utf8')) as Pillar[];
const hrefs = pillars.flatMap((p) => p.topics.flatMap((t) => t.lessons.map((slug) => `/learn/${p.id}/${slug}/`)));
// A lock in words or as an icon: text, or an icon's label, alt text, title or class.
const LOCK = /\block(?:ed|s)?\b|\u{1F512}|\u{1F510}/iu;

test('the map lists every lesson under its pillar and topic, five or fewer to a topic', async ({ page }) => {
  await page.goto('/');
  const shown = await page.locator('main section[aria-labelledby^="pillar-"]').evaluateAll((sections) =>
    sections.map((s) => ({
      pillar: s.querySelector('h3')?.textContent?.trim(),
      topics: [...s.querySelectorAll('h4')].map((h) => ({
        title: h.textContent?.trim(),
        lessons: [...(h.closest('details')?.querySelectorAll('.topic > li > a') ?? [])].map((a) => a.getAttribute('href')),
      })),
    })),
  );
  const expected = pillars.map((p) => ({
    pillar: p.title,
    topics: p.topics.map((t) => ({ title: t.title, lessons: t.lessons.map((slug) => `/learn/${p.id}/${slug}/`) })),
  }));
  expect(shown).toEqual(expected);
  for (const topic of shown.flatMap((p) => p.topics)) expect(topic.lessons.length, topic.title).toBeLessThanOrEqual(5);
});

test('a fresh browser opens every lesson and sees it, and nothing shows a lock', async ({ page }) => {
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of ['/', ...hrefs]) {
    await page.goto(href);
    if (href !== '/') await expect(page.locator('main [data-layer]').first(), href).toBeVisible();
    const locks = await page.evaluate(
      (source) => {
        const re = new RegExp(source, 'iu');
        // The lessons' own words are not the interface: a lesson may say "a request, not a lock" (2.3). Their text is skipped;
        // every label, alt, title and class is scanned, and the text of everything around the lesson parts.
        const els = [...document.querySelectorAll('body *')];
        const labels = els.flatMap((el) => ['aria-label', 'alt', 'title', 'class'].map((a) => el.getAttribute(a) ?? ''));
        const words = els.filter((el) => !el.closest('main [data-part], main [data-layer], script, style')).flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? ''));
        return [...words, ...labels].filter((t) => re.test(t));
      },
      LOCK.source,
    );
    expect(locks, href).toEqual([]);
  }
});

test('every node has a link and a text label', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const nodes = await page.locator('main li[data-lesson]').evaluateAll((items) =>
    items.map((li) => ({
      link: li.querySelector('a[href^="/learn/"]')?.textContent?.trim() ?? '',
      label: (li.querySelector('.state') as HTMLElement | null)?.innerText.trim() ?? '',
    })),
  );
  expect(nodes).toHaveLength(hrefs.length);
  for (const node of nodes) expect(node.link && node.label, JSON.stringify(node)).toBeTruthy();
});

// Spec 7: "Hide my progress: one switch, every page, persists, visible on the map itself". The map's switch and the
// dialog's are one setting.
test("the map's Hide my progress switch is the Settings one, and it persists", async ({ page }) => {
  await page.goto('/');
  const onMap = page.locator('main').getByLabel('Hide my progress');
  const inDialog = page.locator('dialog#settings').getByLabel('Hide my progress');
  await onMap.check();
  await expect(page.locator('html')).toHaveAttribute('data-progress', 'hide');
  await page.reload();
  await expect(onMap).toBeChecked();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  await expect(inDialog).toBeChecked();
  await inDialog.uncheck();
  await expect(onMap).not.toBeChecked();
  await expect(page.locator('html')).not.toHaveAttribute('data-progress');
});

// Polish U1: the state tag sits at the bottom of every card, the same distance from the card's edge whatever the title and
// text, so a learner's eye finds it in one place.
test('the state tag sits at the bottom of every lesson card', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const gaps = await page.locator('.topic > li').evaluateAll((cards) =>
    cards.map((c) => Math.round(c.getBoundingClientRect().bottom - (c.querySelector('.state') as Element).getBoundingClientRect().bottom)),
  );
  expect(gaps.length).toBeGreaterThan(1);
  expect(new Set(gaps).size, `gaps ${[...new Set(gaps)]}`).toBe(1);
});

// Polish U2 and Pool Band v2 (fix round 1, N1): each topic is a native disclosure showing its title and how many lessons it
// holds. Fresh, the first topic is open (the approved first view) and the rest are closed; the site remembers which the
// learner opened or closed on this device only, and a saved choice, even an empty one, replaces the first view.
test('a fresh map opens the first topic only, each topic has its lesson count, and a choice is remembered', async ({ page }) => {
  await page.goto('/');
  const topics = page.locator('.map details');
  expect(await topics.count()).toBeGreaterThan(1);
  expect(await topics.evaluateAll((all) => all.map((d) => (d as HTMLDetailsElement).open))).toEqual(Array.from({ length: await topics.count() }, (_, i) => i === 0));
  for (const summary of await topics.locator('> summary').all()) await expect(summary).toContainText(/\d+ lessons?$/);
  const first = topics.first();
  await expect(first.locator('.topic li').first()).toBeVisible();
  await expect(topics.nth(1).locator('.topic li').first()).toBeHidden();
  await topics.nth(1).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(topics.nth(1).locator('.topic li').first()).toBeVisible();
  await page.waitForFunction(() => localStorage.getItem('nbl:topics')?.length! > 2); // the toggle event writes after the click
  await page.reload();
  await expect(topics.first().locator('.topic li').first(), 'the first view stays with the new choice').toBeVisible();
  await expect(topics.nth(1).locator('.topic li').first()).toBeVisible();
  await topics.first().locator('summary').click();
  await topics.nth(1).locator('summary').click();
  await page.waitForFunction(() => localStorage.getItem('nbl:topics') === '[]');
  await page.reload();
  await expect(topics.first().locator('.topic li').first(), 'an empty saved choice keeps every topic closed').toBeHidden();
  await expect(topics.nth(1).locator('.topic li').first()).toBeHidden();
});

// POL-01: the completion page opens the finished lesson's topic by itself; only the learner's own clicks are remembered.
test('the topic the completion page opens for you is not added to what you chose', async ({ page }) => {
  await page.goto('/');
  const topics = page.locator('.map details');
  const id = await topics.nth(2).locator('li[data-lesson]').first().getAttribute('data-lesson');
  await topics.nth(1).locator('summary').click();
  await page.waitForFunction(() => localStorage.getItem('nbl:topics')?.length! > 2);
  await page.goto(`/done/${id}/`);
  await expect(topics.nth(2).locator('.topic li').first()).toBeVisible();
  await page.goto('/');
  await expect(topics.nth(1).locator('.topic li').first()).toBeVisible();
  await expect(topics.nth(2).locator('.topic li').first()).toBeHidden();
});

test('with storage blocked the topics still open and close', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  const second = page.locator('.map details').nth(1);
  await second.locator('summary').click();
  await expect(second.locator('.topic li').first()).toBeVisible();
  await second.locator('summary').click();
  await expect(second.locator('.topic li').first()).toBeHidden();
});

// Fix round 5 (F5, D02): a row's rail sits halfway between the cards above and the cards it hangs, and the clock and state
// icons take their colour from the text, not the black default (invisible on the dark ground).
test('a rail has the same clearance above its card as below the row before, and icons are not black on dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ theme: 'dark' })));
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const gap = await page.locator('.topic').evaluateAll((lists) =>
    lists.flatMap((ul) => {
      const cards = [...ul.children] as HTMLElement[];
      const row = (c: HTMLElement) => Math.round(c.getBoundingClientRect().top);
      return cards.slice(3).map((c) => {
        const above = cards.find((o) => row(o) < row(c) && o.getBoundingClientRect().left === c.getBoundingClientRect().left) as HTMLElement;
        const rail = parseFloat(getComputedStyle(c, '::before').top);
        return { clearance: c.getBoundingClientRect().top - above.getBoundingClientRect().bottom + rail, rail };
      });
    }),
  );
  expect(gap.length, 'a topic with a second row').toBeGreaterThan(0);
  for (const { clearance, rail } of gap) {
    expect(rail).toBe(-24);
    expect(Math.abs(clearance - 24)).toBeLessThanOrEqual(1);
  }
  const fills = await page.locator('.map .time > .icon').first().evaluate((el) => [getComputedStyle(el).fill, getComputedStyle(el).color]);
  expect(fills[0]).toBe(fills[1]);
});

test('a finished lesson with no badge says how to earn it, and an earned one does not; hiding progress hides the note', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('nbl:progress', JSON.stringify({ v: 1, finished: ['how-ai-works/tokens'], badges: [], steps: [] })));
  await page.reload();
  const note = page.locator('li[data-lesson="how-ai-works/tokens"] .badge-note');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  await expect(note).toBeVisible();
  await expect(note).toContainText('check-in');
  await expect(page.locator('li[data-lesson]:not([data-state="done"]) .badge-note').first()).toBeHidden();
  await page.evaluate(() => localStorage.setItem('nbl:progress', JSON.stringify({ v: 1, finished: ['how-ai-works/tokens'], badges: ['how-ai-works/tokens'], steps: [] })));
  await page.reload();
  await expect(note).toBeHidden();
});
