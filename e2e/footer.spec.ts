// F3: the footer's brand, three named groups and licence line, on every page; the logo is an external link.
import { expect, test } from './guard.ts';

test('the footer has Learn, Project and Policies groups with every link, and the logo links NeuroBridgeEDU out', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  const nav = footer.getByRole('navigation', { name: 'Footer' });
  const groups = {
    Learn: [['Lesson map', '/'], ['Search', '/search/'], ['Help', '/help/']],
    Project: [['About', '/about/'], ['For teachers', '/teachers/'], ["NeuroBridgeEDU's mission (opens in a new tab)", 'https://neurobridgeedu.eu/mission']],
    'Policies and credits': [['Privacy notice', '/privacy/'], ['Accessibility statement', '/accessibility/'], ['Terms of use', '/terms/'], ['Licences and credits', '/licences/'], ['Notices', '/notices/']],
  };
  for (const [heading, links] of Object.entries(groups)) {
    await expect(nav.getByRole('heading', { name: heading })).toBeVisible();
    for (const [name, href] of links) await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  const logo = footer.locator('.logo-link');
  await expect(footer.locator('.brand p').getByRole('link', { name: 'NeuroBridgeEDU (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://neurobridgeedu.eu');
  await expect(logo).toHaveAttribute('href', 'https://neurobridgeedu.eu');
  await expect(logo).toHaveAttribute('target', '_blank');
  await expect(logo.locator('img:visible')).toHaveCount(1);
  await expect(footer).toContainText('Lessons: CC BY-NC-SA 4.0. Code: all rights reserved.');
  await expect(page.locator('.site-header .home')).toHaveAttribute('href', '/'); // the header's logo still goes home
});

test('every footer navigation link and the logo is a 44 px target and has a visible focus mark', async ({ page }) => {
  await page.goto('/about/');
  const links = page.locator('footer nav a:visible, footer .logo-link');
  for (const link of await links.all()) {
    await link.focus();
    const box = (await link.boundingBox()) as { height: number };
    expect(box.height, await link.innerText()).toBeGreaterThanOrEqual(43.5);
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
});

test('Focus mode hides the footer', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ focus: 'on' })));
  await page.goto('/about/');
  await expect(page.locator('footer')).toBeHidden();
});
