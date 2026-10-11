// The feedback page (FB1). The server route is stubbed in every test: nothing here reaches a workflow tool.
import axe from 'axe-core';
import { expect, test, type Page } from './guard.ts';

// Reduced motion, so a colour transition set off by a state change has ended before axe reads the colours (checks/axe.ts).
test.use({ reducedMotion: 'reduce' });

const MESSAGE = 'The practice lab was clear.';
const ROUTE = '**/api/feedback/';

// Records every post and answers it with `status` and `body`. Returns the posted bodies.
async function stub(page: Page, status = 200, body: unknown = { ok: true }) {
  const posted: { method: string; url: string; body: unknown }[] = [];
  await page.route(ROUTE, (route) => {
    const r = route.request();
    posted.push({ method: r.method(), url: r.url(), body: r.postDataJSON() });
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return posted;
}

const send = (page: Page) => page.getByRole('button', { name: /^Send(ing| feedback)$/ });
const result = (page: Page) => page.locator('[data-result]');
const state = (page: Page) => page.locator('[data-feedback]').getAttribute('data-state');

async function fillAndSend(page: Page) {
  await page.getByLabel('Your message').fill(MESSAGE);
  await send(page).click();
}

async function noAxeViolation(page: Page) {
  await page.evaluate(axe.source);
  const found = await page.evaluate(() =>
    axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }).then((r) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')} ${v.nodes[0]?.any[0]?.message}`)),
  );
  expect(found).toEqual([]);
}

test('nothing is sent on load or while typing; Send posts to /api/feedback/ with exactly two keys', async ({ page }) => {
  const posted = await stub(page);
  const urls: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && urls.push(new URL(r.url()).pathname));
  await page.goto('/feedback/');
  await page.getByLabel('What is it about?').selectOption('lab');
  await page.getByLabel('Your message').fill(MESSAGE);
  expect(posted).toEqual([]);
  await send(page).click();
  await expect(result(page)).toHaveText('Thank you. Your message was saved.');
  expect(posted).toHaveLength(1);
  expect(posted[0].url.endsWith('/api/feedback/')).toBe(true);
  expect(posted[0].method).toBe('POST');
  expect(Object.keys(posted[0].body as object).sort()).toEqual(['about', 'message']);
  expect(posted[0].body).toEqual({ about: 'lab', message: MESSAGE });
  expect(urls, 'the host serves /api/feedback/ (trailingSlash); /api/feedback answers 308').toEqual(['/api/feedback/']);
});

test('the page says what it is, warns, and lists the site, the lab, then every lesson by pillar', async ({ page }) => {
  await page.goto('/feedback/');
  await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();
  await expect(page.getByText('We read every message. We cannot reply, because we do not ask who you are.')).toBeVisible();
  await expect(page.getByText('Do not write your name, your email or anything private.')).toBeVisible();
  await expect(page.getByText('Up to 1,500 characters.')).toBeVisible();
  await expect(page.getByText("Pressing Send feedback sends your message and what it is about to this site's server, which passes it to our own tool in the EU to be saved. Nothing else is sent.")).toBeVisible();
  const about = page.getByLabel('What is it about?');
  await expect(about).toHaveValue('site');
  const values = await about.locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(values.slice(0, 2)).toEqual(['site', 'lab']);
  expect(values.slice(2).every((v) => /^[a-z0-9-]+\/[a-z0-9-]+$/.test(v))).toBe(true);
  expect(values).toContain('prompting/iterate-and-check');
  expect(await about.locator('optgroup').count()).toBeGreaterThan(1);
  await expect(page.getByLabel('Your message')).toHaveAttribute('maxlength', '1500');
  await expect(page.getByLabel('Your message')).toHaveAttribute('required', '');
  await noAxeViolation(page);
});

test('Send is off while the message is blank', async ({ page }) => {
  await stub(page);
  await page.goto('/feedback/');
  await expect(send(page)).toBeDisabled();
  await page.getByLabel('Your message').fill('   ');
  await expect(send(page)).toBeDisabled();
  await page.getByLabel('Your message').fill(MESSAGE);
  await expect(send(page)).toBeEnabled();
});

test('on success the line is announced and focused, the text is cleared, and the state is axe clean', async ({ page }) => {
  await stub(page);
  await page.goto('/feedback/');
  await fillAndSend(page);
  await expect(result(page)).toHaveText('Thank you. Your message was saved.');
  await expect(result(page)).toBeFocused();
  await expect(result(page)).toHaveAttribute('role', 'status');
  await expect(page.getByLabel('Your message')).toHaveValue('');
  expect(await state(page)).toBe('sent');
  await noAxeViolation(page);
});

test('while sending the controls cannot change and Send keeps focus; the page has no spinner', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((done) => (release = done));
  await page.route(ROUTE, async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/feedback/');
  await page.getByLabel('Your message').fill(MESSAGE);
  await send(page).focus();
  await page.keyboard.press('Enter');
  expect(await state(page)).toBe('sending');
  await expect(send(page)).toHaveText('Sending');
  await expect(send(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(send(page)).toBeFocused();
  await expect(page.getByLabel('What is it about?')).toBeDisabled();
  await expect(page.getByLabel('Your message')).toHaveJSProperty('readOnly', true);
  await send(page).press('Enter'); // a second press is ignored
  release();
  await expect(result(page)).toHaveText('Thank you. Your message was saved.');
  await expect(page.getByLabel('What is it about?')).toBeEnabled();
});

test('the whole path works by keyboard alone, and Enter in the message is a new line', async ({ page }) => {
  const posted = await stub(page);
  await page.goto('/feedback/');
  await page.getByLabel('What is it about?').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Your message')).toBeFocused();
  await page.keyboard.type('Line one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line two');
  expect(posted).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(send(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(result(page)).toBeFocused();
  expect(posted[0].body).toEqual({ about: 'site', message: 'Line one\nLine two' }); // the select keeps its default untouched
});

test('no sideways scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await stub(page);
  await page.goto('/feedback/');
  await fillAndSend(page);
  await expect(result(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('without JavaScript the form is shown with Send disabled and the noscript line gives the address', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/feedback/');
  await expect(page.locator('[data-feedback] [data-send]')).toBeDisabled();
  // Playwright's text and role engines skip <noscript>, so the line is read from the element.
  const line = await page.locator('[data-feedback] noscript').evaluate((el) => ({
    text: el.textContent,
    href: el.querySelector('a')?.getAttribute('href'),
    shown: getComputedStyle(el).display !== 'none' && getComputedStyle(el.querySelector('p')!).display !== 'none',
  }));
  expect(line).toEqual({ text: 'The feedback form needs JavaScript. You can write to contact@neurobridgeedu.eu.', href: 'mailto:contact@neurobridgeedu.eu', shown: true });
  await context.close();
});

// Every test below stubs a refusal on purpose, so the browser's console line for it is expected (e2e/guard.ts).
test.describe('failures keep the text', () => {
  test.use({ allowApiRefusal: true });

  const cases: [string, number, unknown, string][] = [
    ['429', 429, 'Too many requests', 'That is a lot of messages in a short time. Try again in about ten minutes.'],
    ['413', 413, { error: 'too_large' }, 'That message is too long. Try a shorter one.'],
    ['503 closed', 503, { error: 'closed' }, 'Feedback is closed for now. You can write to contact@neurobridgeedu.eu.'],
    ['503 busy', 503, { error: 'busy' }, 'That did not work. Your message is still here. You can press Send feedback again.'],
  ];
  for (const [name, status, body, line] of cases) {
    test(`${name} shows its line, keeps the text and can send again`, async ({ page }) => {
      const posted = await stub(page, status, body);
      await page.goto('/feedback/');
      await fillAndSend(page);
      await expect(result(page)).toHaveText(line);
      await expect(result(page)).toBeFocused();
      expect(await state(page)).toBe('error');
      await expect(page.getByLabel('Your message')).toHaveValue(MESSAGE);
      await expect(send(page)).toBeEnabled();
      await noAxeViolation(page);
      await send(page).click();
      await expect(result(page)).toHaveText(line);
      expect(posted).toHaveLength(2);
    });
  }

  test('a dropped connection shows the server-trouble line and keeps the text', async ({ page }) => {
    await page.route(ROUTE, (route) => route.abort('connectionfailed'));
    await page.goto('/feedback/');
    await fillAndSend(page);
    await expect(result(page)).toHaveText('That did not work. Your message is still here. You can press Send feedback again.');
    await expect(page.getByLabel('Your message')).toHaveValue(MESSAGE);
  });

  test('a failure, then a success: the text is cleared only by the success', async ({ page }) => {
    let calls = 0;
    await page.route(ROUTE, (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"busy"}' })
        : route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.goto('/feedback/');
    await fillAndSend(page);
    await expect(page.getByLabel('Your message')).toHaveValue(MESSAGE);
    await send(page).click();
    await expect(result(page)).toHaveText('Thank you. Your message was saved.');
    await expect(page.getByLabel('Your message')).toHaveValue('');
  });
});
