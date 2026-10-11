// Progress and the save code (plan T7.5, D7, D8, S3): a right check-in answer is kept, the restore link restores and
// leaves nothing in the address, a typed code forgives case, spaces and look-alike letters, and a bad code says why.
import { SLOTS } from '../src/progress/slots.ts';
import { expect, type Page, test } from './guard.ts';

const id = SLOTS[0]; // slot 0 in the D8 vectors: whatever lesson is first in SLOTS, which check:reviews keeps first
const lesson = `/learn/${id}/`;
const CODE = 'NBL1-G000-0000-4000-0000-0T5D'; // slot 0 finished and badged
const stored = async (page: Page) => JSON.parse((await page.evaluate(() => localStorage.getItem('nbl:progress'))) ?? 'null');
const typeCode = async (page: Page, code: string) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  const move = page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Move your progress' });
  await move.getByLabel('Your save code').fill(code);
  await move.getByRole('button', { name: 'Restore', exact: true }).click();
  return move.locator('.restored[aria-live="polite"]');
};

test('a right check-in answer is kept after a reload', async ({ page }) => {
  await page.goto(lesson);
  await page.locator('.question details[data-right] summary').first().click();
  await expect(page.locator('.question [aria-live]').first()).not.toBeEmpty(); // toggle fires after the click
  await page.reload();
  expect((await stored(page)).steps).toContain(`${id}#checkin-1`);
});

test('the restore link restores in a fresh browser and leaves no fragment', async ({ page }) => {
  await page.goto(`/#p=${CODE}`);
  await expect(page.locator('#restore-status')).toHaveText('Your progress is back on this device.');
  expect(await page.evaluate(() => location.hash)).toBe('');
  expect(page.url()).not.toContain('NBL1');
  expect(await stored(page)).toMatchObject({ finished: [id], badges: [id] });
});

// 2b SHOULD-FIX 1 stays true here: a stored font: lexend (the default) leaves the headings in the look's font.
test('a typed code in lower case, with spaces and o or l for 0 or 1, restores', async ({ page }) => {
  await page.goto('/');
  const font = await page.locator('h1').evaluate((h) => getComputedStyle(h).fontFamily);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ font: 'lexend' })));
  await page.reload();
  await expect(await typeCode(page, 'nbll g000 oooo 4ooo oooo ot5d')).toHaveText('Your progress is back on this device.');
  expect(await stored(page)).toMatchObject({ finished: [id], badges: [id] });
  expect(await page.locator('h1').evaluate((h) => getComputedStyle(h).fontFamily)).toBe(font);
});

test('a code with one wrong character says so plainly and changes nothing', async ({ page }) => {
  await page.goto('/');
  await expect(await typeCode(page, CODE.replace('T5D', 'T6D'))).toHaveText(
    'This save code does not check out. One letter may be mistyped. Check it and try again.',
  );
  expect(await stored(page)).toBeNull();
});

test('a code from another version says so', async ({ page }) => {
  await page.goto('/');
  await expect(await typeCode(page, CODE.replace('NBL1', 'NBL2'))).toHaveText(
    'This save code is from a different version of this site, so it cannot be read here.',
  );
});

// pr7-review SHOULD-FIX 1 and NICE 3: a link opened on a page that is already open, or on a lesson, restores on / and
// says so there.
test('a restore link opened on an open page, or on a lesson, restores and says so', async ({ page }) => {
  for (const from of ['/', lesson]) {
    await page.goto(from);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${from}#p=${CODE}`);
    await expect(page.locator('#restore-status'), from).toHaveText('Your progress is back on this device.');
    expect(page.url(), from).not.toContain('NBL1');
    expect(await stored(page), from).toMatchObject({ finished: [id], badges: [id] });
  }
});

// pr7-review SHOULD-FIX 3 and pr8-review NICE 2: on a phone the typed code shows whole, and this device's code wraps
// in even parts (no line under half the longest), with nothing scrolling sideways.
test('on a phone the whole code shows, typed or given', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
    const field = page.getByRole('dialog', { name: 'Settings' }).getByLabel('Your save code');
    await field.fill('NBL1-WWWW-WWWW-WWWW-WWWW-WWWW');
    expect(await field.evaluate((el) => [el.scrollWidth <= el.clientWidth, el.scrollHeight <= el.clientHeight]), `${width}`).toEqual([true, true]);
    const [shortest, longest, sideways] = await page.locator('#settings .save-code .code').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const widths = [...range.getClientRects()].map((r) => r.width);
      return [Math.min(...widths), Math.max(...widths), el.scrollWidth > el.clientWidth];
    });
    expect(shortest * 2, `${width}`).toBeGreaterThanOrEqual(longest);
    expect(sideways, `${width}`).toBe(false);
  }
});

// foldB-review BLOCKER 1: Enter on a button in Move your progress presses that button and never runs Restore; Enter in
// the field still restores.
test("Enter on each button in Move your progress does that button's own job", async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  const move = page.locator('#move-progress');
  const restored = move.locator('.restored');
  const button = (name: string) => move.getByRole('button', { name, exact: true });
  const enter = async (name: string) => {
    await button(name).focus();
    await page.keyboard.press('Enter');
  };
  await enter('Copy code');
  await expect(move.locator('.said')).toHaveText('Save code copied.');
  await enter('Copy restore link');
  await expect(move.locator('.said')).toHaveText('Restore link copied.');
  await enter('Show QR code');
  await expect(move.locator('.qr')).toBeVisible();
  await enter('Delete my progress on this device');
  await expect(button('Cancel')).toBeFocused();
  await enter('Cancel');
  await expect(button('Delete my progress on this device')).toBeFocused();
  await expect(restored, 'no Restore ran').toBeEmpty();
  await enter('Delete my progress on this device');
  await enter('Yes, delete it');
  await expect(restored).toHaveText('Your progress on this device is deleted.');
  await move.getByLabel('Your save code').fill(CODE);
  await move.getByLabel('Your save code').press('Enter');
  await expect(restored).toHaveText('Your progress is back on this device.');
});

