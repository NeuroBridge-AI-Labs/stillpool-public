// The one P0 smoke test: home loads, CSP holds on every page, keyboard nav reaches a two-layer
// lesson that opens on its Simple layer, and nothing logs a console or page error (a CSP violation is a console error).
import { expect, type Page, test } from './guard.ts';

// S1 L2: anything that runs or styles above the meta runs outside the policy. Only inert metadata and data
// blocks (a JSON-LD script is never executed) may come first.
const allowed = [
  'meta[charset]', 'meta[name="viewport"]', 'title',
  ':is(link[rel="icon"], link[rel="apple-touch-icon"])[href^="/"]:not([href^="//"])',
  'link[rel="preload"][as="font"][href^="/fonts/"]',
  'meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name="twitter:card"]', 'meta[name="twitter:image"]',
  'script[type="application/ld+json"]',
].join(', ');

async function elementsBeforeCsp(page: Page) {
  return page.evaluate((ok) => {
    const kids = [...document.head.children];
    const csp = kids.findIndex((k) => k.matches('meta[http-equiv="content-security-policy" i]'));
    return kids.slice(0, csp).filter((k) => !k.matches(ok)).map((k) => k.outerHTML);
  }, allowed);
}

async function checkHeadAndCsp(page: Page) {
  const content = (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content')) ?? '';
  expect(content).toContain("script-src 'self' 'sha256-");
  expect(content).not.toContain('unsafe-');
  const directives = content.split(';').map((d) => d.trim()).filter(Boolean).map((d) => d.split(/\s+/)[0]);
  expect(new Set(directives).size).toBe(directives.length);

  expect(await elementsBeforeCsp(page)).toEqual([]);
}

test('home loads, CSP holds, keyboard reaches a two-layer lesson, no console or page errors', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await checkHeadAndCsp(page);

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  expect(await focused.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');

  await page.keyboard.press('Enter'); // the skip link moves focus into main
  await page.keyboard.press('Tab'); // the welcome's Start button, to 1.1
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/learn\//);
  await expect(page.locator('[data-layer="simple"]').first()).toBeVisible();
  await expect(page.locator('[data-layer="deep"]').first()).toBeHidden(); // Simple by default (D5)
  await checkHeadAndCsp(page);
});

test('the head rule reports a script or style above the policy and lets inert metadata through', async ({ page }) => {
  const csp = '<meta http-equiv="content-security-policy" content="img-src *">';
  const head = async (before: string) => {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${before}${csp}</head><body></body></html>`);
    return elementsBeforeCsp(page);
  };
  expect(await head('<script>1</script>')).toHaveLength(1);
  expect(await head('<style>a{}</style>')).toHaveLength(1);
  expect(
    await head(
      '<meta name="description" content="d"><link rel="canonical" href="/"><meta property="og:title" content="t"><meta name="twitter:card" content="summary"><meta name="twitter:image" content="https://x.test/a.png"><script type="application/ld+json">{}</script>',
    ),
  ).toEqual([]);
});
