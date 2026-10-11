// The sticky header and what depends on its real height (Pool Band v2, 7d points 4 and 7): it is opaque, it wraps cleanly,
// an anchor or a focused control lands below it, and the reading ruler follows the keyboard without going under it.
import { expect, test, type Page } from './guard.ts';

const LESSON = '/learn/prompting/a-skill-is-a-written-procedure/';
const bottom = (page: Page) => page.locator('.site-header').evaluate((h) => h.getBoundingClientRect().bottom);

test('the header is opaque and sticky at the top, and its measured height is what an anchor clears', async ({ page }) => {
  await page.goto(LESSON);
  const header = await page.locator('.site-header').evaluate((h) => {
    const s = getComputedStyle(h);
    return { position: s.position, top: s.top, background: s.backgroundColor, height: h.getBoundingClientRect().height };
  });
  expect(header.position).toBe('sticky');
  expect(header.top).toBe('0px');
  expect(header.background, 'opaque, so nothing shows through').toMatch(/^rgb\(/);
  await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')))).toBeCloseTo(Math.ceil(header.height), 0);
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)), 'an anchor clears the real height').toBeGreaterThan(header.height);
});

for (const [width, height] of [[320, 640], [390, 844], [1280, 800]])
  test(`with the largest text, OpenDyslexic and the widest spacing the header wraps inside ${width} px and leaves room to read`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ size: '5', font: 'opendyslexic', spacing: 'wider', lines: '2' })));
    await page.setViewportSize({ width, height });
    await page.goto(LESSON);
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(() => {
      const bar = document.querySelector('.site-header') as HTMLElement;
      const outside = [...bar.querySelectorAll('a, button')].filter((el) => el.checkVisibility()).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < -0.5 || r.right > innerWidth + 0.5;
      });
      return { sideways: document.documentElement.scrollWidth > innerWidth, outside: outside.map((el) => el.textContent?.trim()), height: bar.getBoundingClientRect().height };
    });
    expect(found.sideways).toBe(false);
    expect(found.outside, 'every control inside the window').toEqual([]);
    expect(found.height, 'the header never takes more than half the window').toBeLessThan(height / 2);
    // The measured height follows the wrap.
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')))).toBeCloseTo(Math.ceil(found.height), 0);
  });

test('a control the keyboard focuses is never left under the header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LESSON);
  await page.keyboard.press('Tab'); // keyboard modality, so focus() below is a keyboard focus
  const target = page.locator('main [data-part="core"] .depth button').first();
  await target.evaluate((el) => {
    const header = (document.querySelector('.site-header') as HTMLElement).getBoundingClientRect().bottom;
    scrollBy(0, el.getBoundingClientRect().top - header + 20); // 20 px of it under the header
  });
  expect((await target.boundingBox())!.y).toBeLessThan(await bottom(page));
  await target.focus();
  await expect.poll(async () => (await target.boundingBox())!.y).toBeGreaterThanOrEqual(await bottom(page));
});

test('the reading ruler follows the keyboard, stays below the header, and is hidden while Settings is open', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ ruler: 'on' })));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LESSON);
  const ruler = page.locator('.ruler');
  await expect(ruler).toBeVisible();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  const [focus, band] = await Promise.all([page.evaluate(() => { const r = document.activeElement!.getBoundingClientRect(); return r.top + Math.min(r.height, 400) / 2; }), ruler.boundingBox()]);
  expect(band!.y, 'below the header').toBeGreaterThanOrEqual((await bottom(page)) - 1);
  expect(focus >= band!.y - 2 && focus <= band!.y + band!.height + 2, 'the ruler is on the focused control').toBe(true);
  await page.mouse.move(700, 10); // the pointer over the header
  expect((await ruler.boundingBox())!.y, 'never under the header').toBeGreaterThanOrEqual((await bottom(page)) - 1);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(ruler).toBeHidden();
});
