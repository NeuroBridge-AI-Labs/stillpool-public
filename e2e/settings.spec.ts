// The Settings dialog (plan T4.4, D2): each control applies at once and survives a reload, and the dialog itself is
// keyboard-safe and readable in every theme. Settings opens with HTML invoker commands; src/settings.ts does the rest.
import axe from 'axe-core';
import { pages } from '../checks/serve.ts';
import { expect, type Page, test } from './guard.ts';

const NOTE =
  'Choose the font you find easiest to read. Studies have not found that special "dyslexia fonts" help people read faster or more accurately. More space between letters and words does help some readers, so try the spacing setting too.';

const NOJS = 'These settings need JavaScript, which is off in this browser, so choosing one changes nothing.';

const open = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start open, and the learner can close them
  return page.getByRole('dialog', { name: 'Settings' });
};
const choose = async (page: Page, group: string, name: string) => {
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  if (!(await dialog.isVisible())) await open(page);
  await dialog.getByRole('group', { name: group }).getByLabel(name, { exact: true }).check();
};
const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const reload = async (page: Page) => {
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).waitFor();
};

test('the dialog opens from the keyboard, keeps focus inside, closes with Escape, and focus returns to Settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  for (let stop = 0; stop < 30; stop++) {
    await page.keyboard.press('Tab');
    // Past the last control a modal dialog hands Tab to the browser's own controls (body is active); the page is inert.
    const inside = await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog#settings'));
    expect(inside, `Tab ${stop + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
});

test('each font applies to body text, and the three web fonts are loaded', async ({ page }) => {
  await page.goto('/help/');
  for (const [name, family] of [['Public Sans', '"Public Sans"'], ['The system font', 'system-ui'], ['OpenDyslexic', 'OpenDyslexic'], ['Lexend', 'Lexend']]) {
    await choose(page, 'Font', name);
    expect(await style(page, 'main p', 'font-family'), name).toMatch(new RegExp(`^${family}`));
    if (family !== 'system-ui') {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate((f) => document.fonts.check(`1em ${f}`), family), name).toBe(true);
    }
  }
});

test('the spacing control moves letter and word spacing together', async ({ page }) => {
  await page.goto('/help/');
  const both = async () => [await style(page, 'main p', 'letter-spacing'), await style(page, 'main p', 'word-spacing')].map((v) => Number.parseFloat(v) || 0);
  await choose(page, 'Letter and word spacing', 'Normal');
  expect(await both()).toEqual([0, 0]);
  let last = [0, 0];
  for (const name of ['Wide', 'Wider']) {
    await choose(page, 'Letter and word spacing', name);
    const now = await both();
    expect(now[0] > last[0] && now[1] > last[1], `${name}: ${now} after ${last}`).toBe(true);
    last = now;
  }
});

test('line spacing applies: 1.5, 1.75 and 2 times the font size', async ({ page }) => {
  await page.goto('/help/');
  for (const [name, factor] of [['Normal', 1.5], ['More', 1.75], ['Most', 2]] as const) {
    await choose(page, 'Line spacing', name);
    const [line, size] = await Promise.all([style(page, 'main p', 'line-height'), style(page, 'main p', 'font-size')]);
    expect(Number.parseFloat(line) / Number.parseFloat(size), name).toBeCloseTo(factor, 2);
  }
});

test('each of the five sizes applies and survives a reload', async ({ page }) => {
  await page.goto('/');
  for (const [name, px] of [['Small', 16], ['Standard', 18], ['Large', 20], ['Larger', 22], ['Largest', 24]] as const) {
    await choose(page, 'Text size', name);
    await reload(page);
    expect(await style(page, 'html', 'font-size'), name).toBe(`${px}px`);
  }
});

test('each theme applies and survives a reload; "Same as my device" follows dark and more contrast', async ({ page }) => {
  await page.goto('/');
  // A key the form does not own is kept (PR 6's depth); a default is removed, not stored (pr4-review SHOULD-FIX 3, NICE 1).
  await page.evaluate(() => localStorage.setItem('nbl:settings', '{"depth":"deep"}'));
  for (const [name, theme] of [['Light', 'light'], ['Dark', 'dark'], ['High contrast', 'contrast']]) {
    await choose(page, 'Theme', name);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => localStorage.getItem('nbl:settings'))).toBe(JSON.stringify({ depth: 'deep', theme }));
    await expect(page.locator('html')).not.toHaveAttribute('data-font');
    await reload(page);
    await expect(page.locator('html'), name).toHaveAttribute('data-theme', theme);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await choose(page, 'Theme', 'Same as my device');
  await expect(page.locator('html'), 'at once, before a reload').toHaveAttribute('data-theme', 'dark');
  for (const [media, theme] of [[{ colorScheme: 'dark' }, 'dark'], [{ colorScheme: 'light', contrast: 'more' }, 'contrast']] as const) {
    await page.emulateMedia(media);
    await reload(page);
    await expect(page.locator('html'), JSON.stringify(media)).toHaveAttribute('data-theme', theme);
  }
});

test('reduce motion makes every transition and animation 0.001 ms or less; switched off, the token duration is back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const slowest = () =>
    page.evaluate(() =>
      Math.max(...[...document.querySelectorAll('*')].flatMap((el) => {
        const s = getComputedStyle(el);
        return [...s.transitionDuration.split(','), ...s.animationDuration.split(',')].filter((d) => d.trim() !== '').map((d) => Number.parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000));
      })),
    );
  const dialog = await open(page);
  await dialog.getByRole('checkbox', { name: 'Reduce motion' }).check();
  expect(await slowest()).toBeLessThanOrEqual(0.001);
  await dialog.getByRole('checkbox', { name: 'Reduce motion' }).uncheck();
  expect(await style(page, 'header button', 'transition-duration')).toBe('0.15s');
});

test('the reading ruler appears, follows the pointer and the focused element, and hides when switched off', async ({ page }) => {
  await page.goto('/');
  const ruler = page.locator('.ruler');
  await expect(ruler).toBeHidden();
  const dialog = await open(page);
  await dialog.getByRole('checkbox', { name: 'Reading ruler' }).check();
  await page.keyboard.press('Escape');
  await expect(ruler).toBeVisible();
  const middle = async () => ((await ruler.boundingBox()) ?? { y: 0, height: 0 }).y + ((await ruler.boundingBox()) ?? { height: 0 }).height / 2;
  await reload(page); // no input yet: mid-screen, not over the header
  expect(Math.abs((await middle()) - (page.viewportSize()?.height ?? 0) / 2)).toBeLessThan(2);
  await page.mouse.move(200, 300);
  expect(Math.abs((await middle()) - 300)).toBeLessThan(2);
  const link = page.locator('main a').first();
  await link.focus();
  const box = (await link.boundingBox()) ?? { y: 0, height: 0 };
  expect(Math.abs((await middle()) - (box.y + box.height / 2))).toBeLessThan(2);
  await (await open(page)).getByRole('checkbox', { name: 'Reading ruler' }).uncheck();
  await expect(ruler).toBeHidden();
});

// On a lesson, which has the breadcrumb (PR 3 NICE 3: untested until a page had one).
test('focus mode hides the Map and Help links, the breadcrumb and the footer, keeps Settings, and survives a reload', async ({ page }) => {
  await page.goto(pages('dist').find((route) => route.startsWith('/learn/')) as string);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs).toBeVisible();
  await (await open(page)).getByRole('checkbox', { name: 'Focus mode' }).check();
  await page.keyboard.press('Escape');
  await reload(page);
  for (const hidden of [page.getByRole('link', { name: 'Lesson map', exact: true }), page.getByRole('link', { name: 'Help', exact: true }), crumbs, page.locator('footer')])
    await expect(hidden).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
});

test('hide my progress sets its attribute and survives a reload', async ({ page }) => {
  await page.goto('/');
  await (await open(page)).getByRole('checkbox', { name: 'Hide my progress' }).check();
  await reload(page);
  await expect(page.locator('html')).toHaveAttribute('data-progress', 'hide');
  await expect((await open(page)).getByRole('checkbox', { name: 'Hide my progress' })).toBeChecked();
});

test('the font note is in the dialog under Why these fonts?, word for word, and the markup checks the defaults', async ({ page }) => {
  await page.goto('/');
  const dialog = await open(page);
  await dialog.getByText('Why these fonts?').click(); // design polish D3: the note waits in its own disclosure
  await expect(dialog.getByText(NOTE, { exact: true })).toBeVisible();
  // pr4-review SHOULD-FIX 4: a screen reader tabbing through the dialog hears the note with the Font group.
  await expect(dialog.getByRole('group', { name: 'Font' })).toHaveAccessibleDescription(NOTE);
  await expect(dialog.getByText(NOJS)).toBeHidden();
  // [checked] is the served attribute, so this is what a reader without JavaScript sees.
  expect(await page.locator('#settings input[checked]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(['system', 'lexend', '2', 'normal', '1.5', 'on', '1']);
});

test('the open dialog has no axe violation in any theme, and every label and button in it is 44 by 44 px or more', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const dialog = await open(page);
  for (const theme of ['light', 'dark', 'contrast']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    await page.evaluate(axe.source);
    const found = await page.evaluate(() =>
      axe.run('#settings', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }),
    );
    expect(found.violations.map((v) => v.id), theme).toEqual([]);
    // pr4-review SHOULD-FIX 2: native radios and checkboxes follow the theme, not white on a dark dialog.
    expect(await dialog.locator('input').first().evaluate((el) => getComputedStyle(el).colorScheme), theme).toBe(theme === 'dark' ? 'dark' : 'light');
  }
  const small = await dialog.evaluate((d) =>
    [...d.querySelectorAll('label, button')].filter((el) => el.checkVisibility()).map((el) => [el.textContent?.trim(), el.getBoundingClientRect()] as const)
      .filter(([, r]) => r.width < 44 || r.height < 44)
      .map(([name, r]) => `${name}: ${r.width} by ${r.height}`),
  );
  expect(small).toEqual([]);
});

// pr4-review SHOULD-FIX 1: the veil behind the open dialog is never lighter than the page's ground, so a reader who
// chose Dark because light hurts gets no flash. A canvas composites the veil over the ground, as the screen does.
test('opening Settings never brightens the page behind it, in any theme', async ({ page }) => {
  await page.goto('/');
  await open(page);
  for (const theme of ['light', 'dark', 'contrast']) {
    const lift = await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
      const ctx = new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D;
      const paint = (...fills: string[]) => {
        for (const fill of fills) (ctx.fillStyle = fill), ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const ground = getComputedStyle(document.body).backgroundColor;
      const veiled = paint(ground, getComputedStyle(document.querySelector('#settings') as Element, '::backdrop').backgroundColor);
      return Math.max(...paint(ground).map((c, i) => veiled[i] - c));
    }, theme);
    expect(lift, theme).toBeLessThanOrEqual(1);
  }
});

// Fix round 1 (N2): the panel is the page's cream ground and the veil is a translucent Pool Band dark, so the blue band is
// dimmed, not washed out. In every theme the panel matches the page and the veil only darkens it.
for (const theme of ['light', 'dark', 'contrast'])
  test(`Settings is a ground-coloured panel over a dark veil in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    await page.goto('/');
    await open(page);
    const found = await page.evaluate(() => {
      const ctx = new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D;
      const paint = (...fills: string[]) => {
        for (const fill of fills) (ctx.fillStyle = fill), ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const ground = getComputedStyle(document.body).backgroundColor;
      const dialog = document.querySelector('#settings') as Element;
      const veiled = paint(ground, getComputedStyle(dialog, '::backdrop').backgroundColor);
      return { panel: getComputedStyle(dialog).backgroundColor, ground, dimmed: Math.min(...paint(ground).map((c, i) => c - veiled[i])) };
    });
    expect(found.panel).toBe(found.ground);
    expect(found.dimmed, 'the veil darkens every channel').toBeGreaterThanOrEqual(0);
    if (theme === 'light') expect(found.dimmed, 'and dims the cream page clearly').toBeGreaterThan(100);
  });

// Design polish D3 (Emanuel, 27-09-26): a close always in reach. Scrolled to its end, the panel still shows Close and Done.
for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }])
  test(`with the settings panel scrolled to its end, Close and Done are both in view at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const dialog = await open(page);
    await dialog.evaluate((d) => {
      for (const el of [d, ...d.querySelectorAll('*')]) el.scrollTop = el.scrollHeight;
    });
    for (const name of ['Close', 'Done']) await expect(dialog.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

// pr4-review NICE 2: without JavaScript the dialog still opens (invoker commands), so it says why nothing changes.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the dialog says its settings need JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect((await open(page)).getByText(NOJS)).toBeVisible();
  });
});

// Reading speed (design sheet 09-10-26): six native radios, Normal by default and not stored.
test('speed 1 and 2: six radios in order, Normal checked and unstored; a choice is stored, and Normal removes it', async ({ page }) => {
  await page.goto('/help/');
  const dialog = await open(page);
  const group = dialog.getByRole('group', { name: 'Reading speed' });
  await expect(group.getByRole('radio')).toHaveCount(6);
  expect(await group.locator('label').allTextContents()).toEqual(['Normal', '1.1', '1.2', '1.3', '1.4', '1.5']);
  await expect(group.getByLabel('Normal', { exact: true })).toBeChecked();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('nbl:settings') ?? '{}'));
  expect(await stored()).not.toHaveProperty('speed');
  await choose(page, 'Reading speed', '1.3');
  expect((await stored()).speed).toBe('1.3');
  await expect(page.locator('html')).toHaveAttribute('data-speed', '1.3');
  await choose(page, 'Reading speed', 'Normal');
  expect(await stored()).not.toHaveProperty('speed');
  await expect(page.locator('html')).not.toHaveAttribute('data-speed');
});

test('speed 10: at 320 px, largest text and wider spacing, nothing scrolls sideways and every target is 44 px', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ size: '5', spacing: 'wider' })));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/help/');
  const dialog = await open(page);
  const panel = await dialog.locator('.panel-body').evaluate((b) => b.scrollWidth <= b.clientWidth);
  expect(panel).toBe(true);
  await expect(dialog.getByRole('group', { name: 'Reading speed' }).locator('label')).toHaveCount(6);
  for (const box of await dialog.getByRole('group', { name: 'Reading speed' }).locator('label').evaluateAll((all) => all.map((l) => l.getBoundingClientRect())))
    expect(box.width >= 44 && box.height >= 44).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('speed 12: Help, Privacy and Accessibility say it', async ({ page }) => {
  const say = async (route: string, text: string) => {
    await page.goto(route);
    expect(((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ')).toContain(text);
  };
  await say('/help/', 'You can make the voice faster. Press Speed while a part is reading, or open Settings and choose a Reading speed. Normal is 1. The choice is kept in this browser and used on every page.');
  await say('/help/', 'The voice is too fast or too slow');
  await say('/help/', "Open Settings and choose Normal under Reading speed. The browser's own player menu can also change speed, for that part only.");
  await say('/privacy/', 'the reading voice, the reading speed and whether');
  await say('/accessibility/', 'Listening: Read aloud, with a recorded voice made for this site or a voice on your device, at normal speed or up to 1.5 times faster.');
});
