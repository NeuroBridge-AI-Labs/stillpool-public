// The page shell on every built route (plan T3.6; spec P14; WCAG 2.2): the same controls in the same place, a skip
// link, reflow at 320 px, text spacing that clips nothing, 44 px targets, and a visible focus on every Tab stop.
import { pages } from '../checks/serve.ts';
import { CASES, OPTIONS } from '../src/lib/incident-casebook.ts';
import { answerAll } from './cases.ts';
import { expect, test } from './guard.ts';

const routes = pages('dist');
test.beforeEach(() => expect(routes, 'the routes come from dist; an empty list would pass every test here').toContain('/help/'));

// pr6-review SHOULD-FIX 1: measured on a phone too, where a wrapping header once moved them on lesson pages only.
for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }])
  test(`Lesson map, Search, Help and Settings keep one place and order on every route at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    const seen = new Set<string>();
    for (const route of routes) {
      await page.goto(route);
      const boxes = await page.locator('header nav[aria-label="Site"]').evaluate((nav) =>
        [...nav.querySelectorAll('a, button')].map((el) => [el.textContent?.trim(), JSON.stringify(el.getBoundingClientRect())]),
      );
      seen.add(JSON.stringify(boxes));
      expect(boxes.map(([name]) => name), route).toEqual(['Lesson map', 'Search', 'Help', 'Settings']);
      // pr3-review NICE 3: the link to the page you are on says so.
      const current = await page.locator('header nav a[aria-current="page"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
      expect(current, route).toEqual(['/', '/search/', '/help/'].filter((href) => href === route));
    }
    expect([...seen], 'one place on every route').toHaveLength(1);
  });

// Design polish D1 (Emanuel, 27-09-26): the header stays at the top of the viewport while the page scrolls.
test('the header stays at the top while the page scrolls', async ({ page }) => {
  await page.goto('/learn/how-ai-works/rules-or-examples/');
  await page.evaluate(() => scrollTo(0, 2000));
  expect(await page.evaluate(() => scrollY), 'the page scrolled').toBe(2000);
  expect((await page.locator('.site-header').boundingBox())?.y).toBe(0);
});

test('Settings opens its dialog, Close is on screen on a phone, and Close shuts it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' }), 'pr4-review NICE 3: no scrolling to find Close').toBeInViewport();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('dialog#settings')).not.toHaveAttribute('open');
});

test('the first Tab reaches the skip link, and Enter moves focus into main', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus'), route).toHaveText('Skip to main content');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => !!document.activeElement?.closest('main')), route).toBe(true);
  }
});

test('nothing scrolls sideways at 320 by 640', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const route of routes) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(320);
  }
});

test('with the largest text, the widest spacing and WCAG 1.4.12 spacing, nothing clips', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ size: '5', spacing: 'wider', lines: '2' })));
  for (const route of routes) {
    await page.goto(route);
    const found = await page.evaluate(() => {
      // Where WCAG 1.4.12 asks for more than the widest setting: letters 0.12em, paragraphs 2em. CSSOM: CSP allows it.
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('html[data-spacing] * { letter-spacing: 0.12em !important; } html[data-spacing] p { margin-bottom: 2em !important; }');
      document.adoptedStyleSheets = [sheet];
      const clipped = [...document.querySelectorAll('*')].filter(
        (el) => /hidden|clip/.test(getComputedStyle(el).overflow) && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight),
      );
      return { sideways: document.documentElement.scrollWidth > innerWidth, clipped: clipped.map((el) => el.outerHTML.slice(0, 80)) };
    });
    expect(found, route).toEqual({ sideways: false, clipped: [] });
  }
});

test('every button, summary, select, label and header link is at least 44 by 44 px', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, summary, select, label, header a')]
        .filter((el) => el.checkVisibility())
        .map((el) => [el.textContent?.trim(), el.getBoundingClientRect()] as const)
        .filter(([, r]) => r.width < 44 || r.height < 44)
        .map(([name, r]) => `${name}: ${r.width} by ${r.height}`),
    );
    expect(small, route).toEqual([]);
  }
});

// One test per route: all 93 routes in one test took about 23 s on a quiet machine, close to the 30 s limit, and a loaded one
// timed out on whichever route it was walking. The timeout now names the route.
for (const route of routes)
  test(`every Tab stop is visible and on top: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Up to 200: lesson 1.1 has over 40 stops, and the old cap of 40 never reached its finish link (run 8).
    for (let stop = 0; stop < 200; stop++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null; // past the last stop
        // The first line box: a link that wraps has a bounding-box centre on its parent's text, not on the link.
        const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { el: el.outerHTML.slice(0, 60), visible: el.checkVisibility() && r.width > 0 && r.height > 0, onTop: !!top && el.contains(top) };
      });
      if (!focused) break;
      expect(focused, route).toMatchObject({ visible: true, onTop: true });
    }
  });

function splitWords(): string[] {
  const found: string[] = [];
  const walk = document.createTreeWalker(document.querySelector('main') as Node, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    // A cited page's address must reflow at 320 px (WCAG 1.4.10), so it may break inside a word.
    if (node.parentElement?.closest('.citations a')) continue;
    // Likewise a web address on the licences page (WCAG 1.4.10).
    if (node.parentElement?.closest('.credits a')) continue;
    // A recorded answer is verbatim, and may hold a file name too long for a phone, so it may break inside that word.
    if (node.parentElement?.closest('.run .reply')) continue;
    const text = node.textContent ?? '';
    for (const word of text.matchAll(/[^\s/-]+/g)) {
      // A plain-text web address a learner must copy whole may break inside a word on a phone (WCAG 1.4.10).
      const run = text.slice(Math.max(text.lastIndexOf(' ', word.index), text.lastIndexOf('\n', word.index)) + 1).split(/\s/)[0];
      if (/^https?:\/\//.test(run)) continue;
      const range = document.createRange();
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) found.push(word[0]);
    }
  }
  return found;
}

// The word check proven both ways: a long plain-text web address that wraps is not reported, a long ordinary word is.
test('the split-word check exempts a wrapping web address and still reports an ordinary word', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const tail = 'a'.repeat(120);
  const found = async (text: string) => {
    await page.setContent(`<main><p style="overflow-wrap:anywhere">${text}</p></main>`);
    return page.evaluate(splitWords);
  };
  expect(await found(`https://doi.org/${tail}.`)).toEqual([]);
  expect(await found(`x${tail}`)).toEqual([`x${tail}`]);
});

// pr3-review SHOULD-FIX 2: at the default settings on the common phone widths no word is split across two lines.
test('no word in main breaks across two lines at 360 and 390 px', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of routes) {
      await page.goto(route);
      const split = await page.evaluate(splitWords);
      expect(split, `${route} at ${width}`).toEqual([]);
    }
  }
});

// pr3-review SHOULD-FIX 2 and NICE 3: the Help table has a name, scrolls inside its own labelled region, and has no
// blank cells.
test('the Help list of what leaves the device is named by its heading and has no blank entries', async ({ page }) => {
  await page.goto('/help/');
  await expect(page.getByRole('heading', { level: 2, name: 'What leaves your device' })).toBeVisible();
  const entries = page.locator('#leaves ~ dl.facts').first().locator('dt, dd');
  expect(await entries.count()).toBeGreaterThanOrEqual(6);
  expect(await entries.evaluateAll((els) => els.filter((e) => !e.textContent?.trim()).length)).toBe(0);
});

// Carried rule for Wave B: the dark theme is for light-sensitive readers, so nothing in main may paint a background
// lighter than the ground. Every route, so each page Wave B adds is covered as it lands.
test('in the dark theme nothing in main is lighter than the ground', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ theme: 'dark' })));
  for (const route of routes) {
    await page.goto(route);
    const lighter = await page.evaluate(() => {
      const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      const rgba = (colour: string) => {
        canvas.clearRect(0, 0, 1, 1);
        canvas.fillStyle = colour;
        canvas.fillRect(0, 0, 1, 1);
        return [...canvas.getImageData(0, 0, 1, 1).data];
      };
      const light = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const ground = light(rgba(getComputedStyle(document.body).backgroundColor));
      // A painted gradient counts too: every visible colour stop of a background image (a radial glow was once left on the band).
      const stops = (el: Element) => (getComputedStyle(el).backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).map(rgba).filter((c) => c[3] > 0);
      return [...document.querySelectorAll('main, main *')]
        .filter((el) => (rgba(getComputedStyle(el).backgroundColor)[3] > 0 && light(rgba(getComputedStyle(el).backgroundColor)) > ground) || stops(el).some((c) => light(c) > ground))
        .map((el) => el.outerHTML.slice(0, 80));
    });
    expect(lighter, route).toEqual([]);
  }
});

// fold-review, pre-existing: with OpenDyslexic, Wider spacing and Largest text on a narrow phone, a heading still keeps
// whole words (and the page still does not scroll sideways).
test('headings keep whole words with OpenDyslexic, Wider spacing and Largest text at 320 and 360 px', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ font: 'opendyslexic', spacing: 'wider', size: '5' })));
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of routes) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const found = await page.evaluate(() => {
        const split: string[] = [];
        for (const heading of document.querySelectorAll('h1, h2, h3')) {
          const walk = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
          for (let node = walk.nextNode(); node; node = walk.nextNode())
            for (const word of (node.textContent ?? '').matchAll(/[^\s/-]+/g)) {
              const range = document.createRange();
              range.setStart(node, word.index);
              range.setEnd(node, word.index + word[0].length);
              if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) split.push(word[0]);
            }
        }
        return { split, sideways: document.documentElement.scrollWidth > innerWidth };
      });
      expect(found, `${route} at ${width}`).toEqual({ split: [], sideways: false });
    }
  }
});

// Polish P1, item 1: a numbered list in a lesson's prose shows its numbers, indented and spaced like a bulleted one.
test('a numbered list in lesson prose shows its numbers, laid out like a bulleted list', async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/learn/using-ai-well/privacy-habits/', '/learn/going-deeper/evaluation/', '/learn/ethics/the-law/']) {
      await page.goto(route);
      const found = await page.evaluate(() => {
        const layer = document.querySelector('[data-layer]') as Element;
        const ul = layer.appendChild(document.createElement('ul'));
        const want = getComputedStyle(ul);
        const ours = [...document.querySelectorAll('[data-layer] ol')].map((ol) => {
          const css = getComputedStyle(ol);
          return css.listStyleType === 'decimal' && css.paddingLeft === want.paddingLeft && css.marginBottom === want.marginBottom;
        });
        ul.remove();
        return ours;
      });
      expect(found.length, `${route} has a numbered list`).toBeGreaterThan(0);
      expect(found, `${route} at ${width}`).not.toContain(false);
    }
  }
});

// Polish P1, item 2: a table in a lesson's prose scrolls inside its own labelled, focusable box, like a recorded reply's.
test('a table in lesson prose scrolls inside its own box and the page does not scroll sideways', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ depth: 'deep' })));
  for (const route of ['/learn/prompting/context/', '/learn/prompting/bad-and-good-prompts/', '/learn/using-ai-well/when-text-tricks-the-ai/']) {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      const box = page.locator('[data-layer="deep"] .table-scroll[role="region"][tabindex="0"]');
      await expect(box, `${route} at ${width}`).toHaveCount(1);
      expect(await box.getAttribute('aria-label')).toBeTruthy();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} at ${width}`).toBeLessThanOrEqual(width);
    }
  }
});

// Polish P1, item 3: the long word "Representatives" (sources list, incident casebook) is not split across lines at 320 px.
// (With OpenDyslexic + Wider spacing + Largest text the word alone is ~317 px, wider than the column: it must break, WCAG 1.4.10.)
test('"Representatives" stays whole at 320 px with default and largest text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const settings of [{ depth: 'deep' }, { depth: 'deep', size: '5' }]) {
    await page.addInitScript((s) => localStorage.setItem('nbl:settings', JSON.stringify(s)), settings);
    await page.goto('/learn/ethics/harm-and-misuse/');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    await answerAll(page, { lesson: '', picks: CASES.map(() => OPTIONS[0]), scenes: [], answers: [] });
    const split = await page.evaluate(() => {
      const found: string[] = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode())
        for (const word of (node.textContent ?? '').matchAll(/Representatives/g)) {
          const range = document.createRange();
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          const rects = [...range.getClientRects()];
          if (rects.length && new Set(rects.map((r) => Math.round(r.top))).size > 1) found.push(node.parentElement?.className || node.parentElement?.tagName || '?');
        }
      return found;
    });
    expect(split, `split at ${JSON.stringify(settings)}`).toEqual([]);
  }
});

// Polish P2, item 1: in the dark theme an unchosen activity radio is a hollow ring like the check-in's, not a filled grey disc.
test('dark theme: an unchosen activity radio is drawn like the check-in radio, and a chosen one differs', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ theme: 'dark' })));
  for (const route of ['/learn/going-deeper/agents-and-tools/', '/learn/how-ai-works/rules-or-examples/']) {
    await page.goto(route);
    const drawn = await page.evaluate(() => {
      const pick = (s: CSSStyleDeclaration) => [s.appearance, s.borderTopWidth, s.borderTopColor, s.borderTopStyle, s.borderRadius, s.backgroundColor, s.width];
      const ring = pick(getComputedStyle(document.querySelector('.question summary') as Element, '::before'));
      const radio = document.querySelector('[data-part="tryit"] fieldset input[type="radio"]') as HTMLInputElement;
      const unchosen = pick(getComputedStyle(radio));
      radio.checked = true;
      const chosen = getComputedStyle(radio);
      return { ring, unchosen, filled: chosen.boxShadow !== 'none' };
    });
    // The ring is 1.1rem wide; compare all but the width, which the activity may size its own way.
    expect(drawn.unchosen.slice(0, 6), route).toEqual(drawn.ring.slice(0, 6));
    expect(drawn.filled, `${route}: a chosen radio looks different`).toBe(true);
  }
});

// Polish P2, item 2: a Where next card with no link (lesson 4.1) bolds its title like the link the others have.
test('Where next without a link is bold, and not a link', async ({ page }) => {
  await page.goto('/learn/using-ai-well/check-it-before-you-use-it/');
  const title = page.locator('[data-part="wherenext"] .next p').nth(1);
  await expect(title.locator('a')).toHaveCount(0);
  expect(await title.evaluate((p) => getComputedStyle(p.firstElementChild ?? p).fontWeight)).toBe('700');
});

// Polish P2, item 3: a wrapping Where next link lays out as running text, so its new-tab icon follows the last word.
test('Where next link wraps as text at 390 and keeps a 44 px target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/learn/using-ai-well/when-not-to-use-ai/', '/learn/going-deeper/agents-and-tools/']) {
    await page.goto(route);
    const link = page.locator('[data-part="wherenext"] .next a');
    expect(await link.evaluate((a) => getComputedStyle(a).display), route).not.toMatch(/flex|grid/);
    expect((await link.boundingBox())?.height, route).toBeGreaterThanOrEqual(44);
  }
});

// Polish P3, finding 2: only a numbered list in lesson prose gets numbers; a component's own lists keep what they had.
test('the layer explorer lists in lesson 2.5 have no list markers, prose lists still do', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ depth: 'deep' })));
  await page.goto('/learn/prompting/format/');
  const types = await page.locator('.layer-explorer ol').evaluateAll((ols) => ols.map((ol) => getComputedStyle(ol).listStyleType));
  expect(types.length, 'the explorer has its two lists').toBe(2);
  expect(types).toEqual(['none', 'none']);
});

// Polish P3, finding 1: in forced colours the chosen activity radio looks different from an unchosen one.
test('under forced colours a chosen activity radio differs from an unchosen one', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  for (const route of ['/learn/how-ai-works/why-they-make-things-up/', '/learn/going-deeper/evaluation/']) {
    await page.goto(route);
    const [first, second] = [0, 1].map((n) => page.locator('.shell fieldset label > input[type="radio"]').nth(n));
    const before = await second.screenshot();
    await first.check();
    await first.evaluate((el) => (el as HTMLElement).blur());
    await page.mouse.move(0, 0);
    const chosen = await first.screenshot();
    const unchosen = await second.screenshot();
    expect(before.equals(unchosen), `${route}: the other radio did not change`).toBe(true);
    expect(chosen.equals(unchosen), `${route}: chosen and unchosen look the same`).toBe(false);
  }
});
