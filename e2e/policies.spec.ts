// F2: the privacy notice, accessibility statement and terms of use: each route answers, has one h1 and its contents, says what
// Stillpool does, and is linked from the footer. The count's words follow the build flag, as the pages do.
import { expect, test } from './guard.ts';

const count = process.env.PUBLIC_ANALYTICS === '1';
const PAGES = [
  ['/privacy/', 'Privacy notice', ['nbl:settings', 'nbl:progress', 'nbl:topics', 'sets no cookies', 'Irish Data Protection Commission', 'Vercel', 'Mistral AI, a company in Paris']],
  ['/accessibility/', 'Accessibility statement', ['WCAG 2.2', 'axe-core', 'screen reader', 'contact@neurobridgeedu.eu']],
  ['/terms/', 'Terms of use', ['CC BY-NC-SA 4.0', 'all rights reserved', 'not professional advice', 'laws of Ireland']],
] as const;

for (const [route, title, phrases] of PAGES)
  test(`${route} is a page with one h1, a contents list, its facts, and a link in the footer`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    for (const phrase of phrases) expect(text, phrase).toContain(phrase);
    expect(text).not.toContain('\u2014');
    expect(text).toContain(route === '/privacy/' ? '10 October 2026' : '5 October 2026');
    await page.setViewportSize({ width: 1280, height: 800 });
    const toc = page.getByRole('navigation', { name: 'On this page' });
    for (const link of await toc.getByRole('link').all()) await expect(page.locator((await link.getAttribute('href')) as string)).toHaveCount(1);
    await expect(page.locator('footer').getByRole('link', { name: title })).toHaveAttribute('href', route);
  });

test('the privacy notice and Help name the cookieless count only in a build that has it, and never say "no trackers"', async ({ page }) => {
  for (const route of ['/privacy/', '/help/']) {
    await page.goto(route);
    const text = await page.locator('main').innerText();
    expect(text, route).not.toMatch(/no trackers/i);
    expect(/Vercel Web Analytics|count of page visits/.test(text), route).toBe(count);
  }
  await page.goto('/privacy/');
  expect(await page.locator('main a[href="https://vercel.com/legal/privacy-policy"]').count()).toBe(1);
});

test('the contents list is a closed disclosure on a phone and always open beside the text on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy/');
  await expect(page.getByRole('link', { name: 'Contact', exact: true })).toBeHidden();
  await page.getByText('On this page', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Contact' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Contact' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
