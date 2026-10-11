// The /done page (plan T8.1 to T8.4, D8; spec 3.1 and 7): finishing lights the lesson on the map with a shape, a
// colour and a label, the save code copies, and the QR code is an inline SVG that fetches nothing.
import { pages } from '../checks/serve.ts';
import { expect, type Page, test } from './guard.ts';

const lesson = pages('dist').find((route) => route.startsWith('/learn/')) as string;
const id = lesson.split('/').slice(2, 4).join('/');
const node = (page: Page) => page.locator(`main li[data-lesson="${id}"]`);
// The state's shape (its one visible icon) and colour, and the colour its token names.
const look = async (page: Page, token: string) => {
  await node(page).evaluate((li) => ((li.closest('details') as HTMLDetailsElement).open = true)); // topics start closed
  return node(page).locator('.state').evaluate((el, t) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${t})`; // a CSSOM write, which the CSP allows
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    const shown = [...el.querySelectorAll('svg')].filter((svg) => svg.checkVisibility());
    const colour = shown.length === 1 && getComputedStyle(shown[0]).color === want;
    return { label: (el as HTMLElement).innerText.trim(), shape: shown.map((svg) => svg.getAttribute('class')).join(), colour };
  }, token);
};

test("finishing lights the lesson's node on /done and on the map, with shape, colour and label", async ({ page }) => {
  await page.goto('/');
  const before = await look(page, '--state-todo');
  expect(before).toMatchObject({ label: 'Not yet', colour: true });
  await page.goto(lesson);
  await page.getByRole('link', { name: 'I have finished this lesson' }).click();
  await expect(page).toHaveURL(`/done/${id}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lesson finished');
  const here = await look(page, '--state-here');
  expect(here).toMatchObject({ label: 'Just finished', colour: true });
  await page.goto('/');
  const done = await look(page, '--state-done');
  expect(done).toMatchObject({ label: 'Finished', colour: true });
  expect(new Set([before.shape, here.shape, done.shape]).size, 'three shapes').toBe(3);
});

test('/done shows the save code, and Copy puts it on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/done/${id}/`);
  const block = page.locator('main .save-code');
  const code = (await block.locator('.code').textContent()) ?? '';
  expect(code).toMatch(/^NBL1(?:-[0-9A-Z]{4}){5}$/);
  expect(code, 'this lesson is finished, so the code is not the empty one').not.toBe('NBL1-0000-0000-0000-0000-1N0F');
  await expect(block.locator('.link')).toHaveText(new RegExp(`/#p=${code}$`));
  await block.getByRole('button', { name: 'Copy code' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
});

test('Show QR code draws an inline SVG with a label and requests no image', async ({ page }) => {
  await page.goto(`/done/${id}/`);
  const images: string[] = [];
  // The footer's logo loads lazily, so a scroll may fetch it; the QR code is what must request no image.
  page.on('request', (r) => r.resourceType() === 'image' && !r.url().includes('/brand/') && images.push(r.url()));
  const block = page.locator('main .save-code');
  await block.getByRole('button', { name: 'Show QR code' }).click();
  const qr = block.getByRole('img', { name: /QR code/ });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((el) => el.querySelector('svg') !== null && !el.querySelector('img'))).toBe(true);
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(qr).toBeVisible();
  expect(images).toEqual([]);
});

// pr8-review NICE 1 and pr5-review NICE 3: without JavaScript nothing that needs it shows, and /done says why.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the map and /done show no state, switch or save-code section, and /done says why', async ({ page }) => {
    for (const route of ['/', `/done/${id}/`]) {
      await page.goto(route);
      const shown = await page.locator('main :is(.state, .map-switch, .save-code, [aria-labelledby="done-save"])').evaluateAll((els) => els.filter((el) => el.checkVisibility()).length);
      expect(shown, route).toBe(0);
    }
    await expect(page.locator('main .needs-js')).toHaveText('Your progress needs JavaScript, which is off in this browser, so nothing here is kept.');
  });
});

// Fix round 5 (F10, F12, F13): the save area comes before the map, Copy restore link copies the link, a refused clipboard
// says which text to select, and the page says whether the badge is earned and which activity earns it.
test('/done is wide, puts the save code before the map, and copies the code and the link separately', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/done/${id}/`);
  const main = await page.locator('main').boundingBox();
  expect(main?.width).toBeGreaterThan(1100);
  const [save, map] = await Promise.all([page.locator('.done-save').boundingBox(), page.locator('.map').boundingBox()]);
  expect(save!.y).toBeLessThan(map!.y);
  const block = page.locator('main .save-code');
  const code = (await block.locator('.code').textContent()) ?? '';
  await block.getByRole('button', { name: 'Copy restore link' }).click();
  await expect(block.locator('.said')).toHaveText('Restore link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/#p=${code}`);
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(block.locator('.said')).toHaveText('Save code copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
});

test('a refused clipboard says which text to select', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } }));
  await page.goto(`/done/${id}/`);
  const block = page.locator('main .save-code');
  await block.getByRole('button', { name: 'Copy restore link' }).click();
  await expect(block.locator('.said')).toHaveText('Copy did not work in this browser. Select the restore link and copy it instead.');
});

test('/done says the badge is earned separately and links to the check-in, then shows the badge once earned', async ({ page }) => {
  await page.goto(`/done/${id}/`);
  const missing = page.locator('.done-badge .badge-missing');
  await expect(missing).toBeVisible();
  await expect(missing.getByRole('link', { name: 'Go to the check-in' })).toHaveAttribute('href', `/learn/${id}/#part-checkin`);
  await page.evaluate((lessonId) => localStorage.setItem('nbl:progress', JSON.stringify({ v: 1, finished: [lessonId], badges: [lessonId], steps: [] })), id);
  await page.reload();
  await expect(page.locator('.done-badge .earned-note')).toBeVisible();
  await expect(page.locator('.done-badge').getByRole('img', { name: 'Badge earned' })).toBeVisible();
  await expect(missing).toBeHidden();
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ progress: 'hide' })));
  await page.reload();
  await expect(page.locator('.done-badge')).toBeHidden();
});
