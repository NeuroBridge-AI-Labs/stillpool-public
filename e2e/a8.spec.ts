import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './guard.ts';

// Playwright's WebKit screenshots inject a body {} stylesheet to sync animations. Permit that only in these pixel probes.
test.describe('pad selection pixels', () => {
  test.use({ bypassCSP: true });
// Real drags must leave neither a selected SVG nor a painted background. Empty selection text alone misses SVG selection.
for (const outside of [false, true]) test(`A8: ${outside ? 'outside-to-pad' : 'drawing'} drag leaves the pad unpainted`, async ({ page, browserName }) => {
  await page.goto('/learn/how-ai-works/images-and-sound/');
  const pad = page.locator('.doodle-guesser .pad svg');
  await pad.scrollIntoViewIfNeeded();
  const at = (await pad.boundingBox())!;
  let frame = 0;
  const pixel = async () => {
    // Sample the visible viewport, with a new image URL for each frame so WebKit cannot reuse decoded pixels.
    const png = await page.screenshot({ caret: 'initial', scale: 'css' });
    const url = `/a8-probe-${frame++}.png`;
    await page.route(`**${url}`, (route) => route.fulfill({ body: png, contentType: 'image/png' }));
    const rgba = await page.evaluate(async ({ url, x, y }) => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(Math.floor(x + 12), Math.floor(y + 12), 1, 1).data];
    }, { url, x: at.x, y: at.y });
    await page.unroute(`**${url}`);
    return rgba;
  };
  const unselected = await pixel();
  await page.mouse.move(at.x + 40, at.y + (outside ? -35 : 40));
  await page.mouse.down();
  for (const [x, y] of [[55, 55], [130, 90], [150, 155], [190, 200]]) await page.mouse.move(at.x + x, at.y + y, { steps: 8 });
  await page.mouse.up();
  const evidence = await pad.evaluate((svg) => {
    const look = (el: Element) => { const c = getComputedStyle(el); return { background: c.backgroundColor, outline: c.outline, boxShadow: c.boxShadow, fill: c.fill }; };
    const s = getSelection();
    return { pad: look(svg.parentElement!), svg: look(svg), selection: s?.toString(), selectionType: s?.type, selectedPad: !!s && !s.isCollapsed && s.containsNode(svg, true), active: document.activeElement?.outerHTML.slice(0, 200), focusVisible: svg.matches(':focus-visible') };
  });
  const selected = await pixel();
  if (process.env.A8_STAGE) {
    mkdirSync('a8-evidence', { recursive: true });
    const label = `${process.env.A8_STAGE}-${browserName}-${outside ? 'outside' : 'inside'}`;
    writeFileSync(`a8-evidence/${label}.json`, JSON.stringify({ ...evidence, unselected, selected }, null, 2));
    await page.screenshot({ path: `a8-evidence/${label}.png`, caret: 'initial' });
    console.log(`A8 PROBE ${label}: ${JSON.stringify({ ...evidence, unselected, selected })}`);
  }
  expect(evidence.svg).toMatchObject({ background: 'rgba(0, 0, 0, 0)', fill: 'none', boxShadow: 'none' });
  expect(selected, 'browser selection must not paint the pad blue').toEqual(unselected);
  // The pad is not a focus stop (it has no tabindex): the keyboard path is the activity's own radios and buttons.
  expect(await pad.evaluate((el) => el.hasAttribute('tabindex'))).toBe(false);
  await page.locator('.doodle-guesser .pad button').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await pad.evaluate((el) => el !== document.activeElement)).toBe(true);
});

});

test('A8: recorded bold and headings are HTML in the prompt activity', async ({ page }) => {
  await page.goto('/learn/prompting/bad-and-good-prompts/');
  await page.getByLabel('Read it as text instead', { exact: true }).check();
  await expect(page.locator('[data-reply] strong').first()).toBeVisible();
  expect(await page.locator('[data-reply]').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/\*\*|^### /m)]));
});

test('A8: hidden-characters featured replies are formatted too', async ({ page }) => {
  await page.goto('/learn/prompting/context/');
  await expect(page.locator('.hidden-characters .runs-pair .reply strong').first()).toBeVisible();
});

test('A8: search reply renders GAA source markdown as plain unlinked words', async ({ page }) => {
  await page.goto('/learn/how-ai-works/where-your-question-goes/');
  await page.getByLabel('Read it as text instead', { exact: true }).check();
  expect((await page.locator('[data-reply]').allTextContents()).join('\n')).not.toMatch(/\]\(https?:|\*\*/);
  await expect(page.locator('[data-reply] a')).toHaveCount(0);
  await expect(page.locator('[data-reply] ul li').filter({ hasText: 'GAA.ie (official website)' })).toBeVisible();
  await expect(page.locator('.citations blockquote ul li').filter({ hasText: 'Dates:' }).first()).toBeVisible();
});

test('A8: checked study answers use real lists and rules', async ({ page }) => {
  await page.goto('/learn/how-ai-works/why-they-make-things-up/');
  await page.getByLabel('Read it as text instead', { exact: true }).check();
  await page.locator('.made-up-runs > summary').click();
  await expect(page.locator('[data-answer-line] ul li').first()).toBeVisible();
  expect((await page.locator('[data-answer-line]').allTextContents()).join('\n')).not.toMatch(/^\s*(?:\d+\. |[-*] |---\s*$)/m);
});

// Fix round 1 (N7): the "Study N:" label reads beside the first line of its answer, not on a line of its own.
test('A8: a checked study answer\'s "Study N:" label sits beside the answer\'s first line', async ({ page }) => {
  await page.goto('/learn/how-ai-works/why-they-make-things-up/');
  await page.getByLabel('Read it as text instead', { exact: true }).check();
  await page.locator('.made-up-runs > summary').click();
  const label = page.locator('.study-line > strong', { hasText: /^Study \d+: $/ }).first();
  await expect(label).toBeVisible();
  const [name, answer] = await Promise.all([label.boundingBox(), label.locator('xpath=following-sibling::*[1]').boundingBox()]);
  expect(answer!.x, 'beside the answer').toBeGreaterThan(name!.x + name!.width - 1);
  expect(Math.abs(answer!.y - name!.y), 'on its first line').toBeLessThan(name!.height);
});
