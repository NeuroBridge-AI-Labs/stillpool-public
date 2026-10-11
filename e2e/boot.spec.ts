// The boot script sets data-theme on <html> before the first paint, from stored settings or the
// device's colour scheme (plan D2); a script the CSP blocks would show up as a console error.
import { expect, test } from './guard.ts';

test('a stored dark theme is on <html> at first load, with no console error', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ theme: 'dark' })));
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const firstChild = await page.evaluate(() => {
    const el = document.body.firstElementChild;
    return el ? { tag: el.tagName, src: el.hasAttribute('src'), type: el.hasAttribute('type') } : null;
  });
  expect(firstChild).toEqual({ tag: 'SCRIPT', src: false, type: false });
});

test('"Match my device" follows an emulated dark colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

// pr2-review SHOULD-FIX 2: the reader's spacing, line spacing and font reach an element that sets its own, even with a
// selector as strong as a Tailwind hover: or dark: variant; code keeps its monospace. The rule is injected through
// CSSOM, which the CSP allows. Both steps of each setting, word spacing and every code element (pr2b-review SHOULD-FIX 3).
for (const [spacing, lines, letter, word] of [['wider', '2', 0.1, 0.35], ['wide', '1.75', 0.05, 0.175]] as const)
  test(`stored spacing ${spacing}, line spacing ${lines} and font win over an element's own, and code stays monospace`, async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('nbl:settings', JSON.stringify(s)), { spacing, lines, font: 'public-sans' });
    await page.goto('/');

    const [found, family, mono] = await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('html body p.own[class] { letter-spacing: 0; word-spacing: 0; line-height: 1.2; font-family: serif; }');
      document.adoptedStyleSheets = [sheet];
      const own = document.body.appendChild(Object.assign(document.createElement('p'), { className: 'own', textContent: 'Own' }));
      const s = getComputedStyle(own);
      const em = (px: string) => parseFloat(px) / parseFloat(s.fontSize);
      // Each code element and what is inside it, and MathML (pr2b-review NICE 1).
      const mono = ['code', 'kbd', 'samp'].flatMap((tag) => {
        const el = own.appendChild(document.createElement(tag));
        return [el, el.appendChild(document.createElement('span'))];
      });
      mono.push(own.appendChild(document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math')) as unknown as HTMLElement);
      return [[em(s.letterSpacing), em(s.wordSpacing), em(s.lineHeight)], s.fontFamily, mono.map((el) => getComputedStyle(el).fontFamily)] as const;
    });
    expect(found.map((v) => v.toFixed(3))).toEqual([letter, word, Number(lines)].map((v) => v.toFixed(3)));
    expect(family).toMatch(/^"Public Sans"/);
    for (const m of mono) expect(m).not.toMatch(/Public Sans/);
  });

// pr2b-review SHOULD-FIX 1: a stored default font (PR 7's import can write one) changes nothing, so the look's
// headings keep their display font; only a font the reader chose reaches them.
test('a stored default font leaves the headings in the display font', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ font: 'lexend' })));
  await page.goto('/help/');
  expect(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Public Sans"/);
  expect(await page.locator('main p').first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Lexend/);
});
