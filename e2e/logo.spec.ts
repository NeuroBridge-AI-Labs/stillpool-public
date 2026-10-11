// The NBEDU logo on every built route (Emanuel, 26-09-26 12:39): one logo in the header and one in the footer, loaded,
// sized, the right file for the theme and readable on what is behind it; and the favicon and home-screen icon.
import { pages } from '../checks/serve.ts';
import { expect, type Page, test } from './guard.ts';

const routes = pages('dist');
test.beforeEach(() => expect(routes, 'the routes come from dist; an empty list would pass every test here').toContain('/help/'));

// [stored theme, the device's colour scheme]. A stored theme meets the opposite device, so a rule that follows the
// device instead of the theme boot.js resolved fails.
const STATES = {
  light: ['light', 'dark'],
  dark: ['dark', 'light'],
  hc: ['contrast', 'dark'],
  'system-light': [null, 'light'],
  'system-dark': [null, 'dark'],
} as const;
const WORDMARK: Record<string, string> = { 'nbedu-logo-light.png': '#040505', 'nbedu-logo-dark.png': '#EFEFEF' };

const luminance = (rgb: number[]) =>
  rgb
    .map((v) => v / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Every visible logo in one landmark, with its box and the colour of the first ancestor that paints a background.
const logos = (page: Page, where: string) =>
  page.evaluate((where) => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>(`${where} img`)].filter((img) => img.checkVisibility());
    return imgs.map((img) => {
      let el = img.parentElement as Element;
      while (el.parentElement && getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)') el = el.parentElement;
      const r = img.getBoundingClientRect();
      const inside = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      const bg = getComputedStyle(el).backgroundColor;
      return { file: img.currentSrc.split('/').pop() ?? '', loaded: img.naturalWidth > 0, lazy: img.loading === 'lazy', w: r.width, h: r.height, inside, bg };
    });
  }, where);

function judge(found: Awaited<ReturnType<typeof logos>>, label: string, file: string, [min, max]: number[]) {
  if (found.length !== 1) return [`${label}: ${found.length} logos visible`];
  const { loaded, lazy, w, h, inside, bg } = found[0];
  const bad = [];
  if (!loaded) bad.push(`${label}: a: ${found[0].file} did not load`);
  // pr3b-review NICE 1: the footer's logo loads lazily, the header's at once.
  if (lazy !== label.endsWith('footer')) bad.push(`${label}: a: loading ${lazy ? 'lazy' : 'eager'}`);
  if (h < min || h > max) bad.push(`${label}: a: ${h} px tall, not ${min} to ${max}`);
  if (Math.abs(w / h / (309 / 168) - 1) > 0.02) bad.push(`${label}: a: ${w} by ${h} px is not the shape of 309 by 168`);
  if (!inside) bad.push(`${label}: a: not fully inside the viewport`);
  if (found[0].file !== file) bad.push(`${label}: b: ${found[0].file}, expected ${file}`);
  const ink = (WORDMARK[found[0].file] ?? '#000000').match(/\w\w/g)?.map((x) => Number.parseInt(x, 16)) ?? [];
  const c = ratio(ink, bg.match(/\d+/g)?.slice(0, 3).map(Number) ?? []);
  // pr3b-review NICE 2: only an opaque rgb() can be judged; a see-through or color() background fails, not passes.
  if (!bg.startsWith('rgb(')) bad.push(`${label}: c: ${bg} is not an opaque colour, so the wordmark cannot be judged`);
  else if (c < 4.5) bad.push(`${label}: c: wordmark ${c.toFixed(2)}:1 on ${bg} < 4.5:1`);
  return bad;
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }])
  for (const [state, [stored, device]] of Object.entries(STATES))
    test(`${state} at ${viewport.width} by ${viewport.height}: one logo in the header and the footer, the right file, sized and readable`, async ({ page }) => {
      test.setTimeout(30_000 + routes.length * 1_000); // the walk visits every route in one test: about 1 s a route, as the site grows
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: device });
      if (stored) await page.addInitScript((theme) => localStorage.setItem('nbl:settings', JSON.stringify({ theme })), stored);
      const file = state.endsWith('dark') ? 'nbedu-logo-dark.png' : 'nbedu-logo-light.png';
      const findings: string[] = [];
      for (const route of routes) {
        await page.goto(route);
        // The header is the dark band in every theme, so it always carries the dark lockup (Pool Band v2, 04-10-26).
        findings.push(...judge(await logos(page, '.site-header'), `${route} header`, 'nbedu-logo-dark.png', [44, 56]));
        await page.locator('.site-footer .logo:visible').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('.site-footer img')].every((i) => !i.checkVisibility() || (i as HTMLImageElement).complete));
        findings.push(...judge(await logos(page, '.site-footer'), `${route} footer`, file, [56, 72]));
        if (await page.locator('main img[src^="/brand/"]').count()) findings.push(`${route}: a logo inside main`);
      }
      expect(findings).toEqual([]);
    });

test('every page links a favicon and a home-screen icon, and each answers 200 with an image type', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    for (const rel of ['icon', 'apple-touch-icon']) {
      const href = await page.locator(`link[rel="${rel}"]`).getAttribute('href');
      const res = await page.request.get(new URL(href ?? '', page.url()).href);
      expect([res.status(), res.headers()['content-type']], `${route} ${rel} ${href}`).toEqual([200, expect.stringMatching(/^image\//)]);
    }
  }
});
