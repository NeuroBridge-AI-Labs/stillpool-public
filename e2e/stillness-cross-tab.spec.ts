import { expect, test } from './guard.ts';

test('a lesson finishing in another tab does not change idle pages', async ({ context, baseURL }) => {
  const urls = ['/404.html', '/', '/done/how-ai-works/rules-or-examples/', '/learn/how-ai-works/rules-or-examples/'];
  const watched = await Promise.all(urls.map(async (url) => {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      (window as unknown as { changes: string[] }).changes = [];
      new MutationObserver((records) => (window as unknown as { changes: string[] }).changes.push(...records.map((record) =>
        `${record.type}:${record.target.nodeName}${record.target instanceof Element ? `.${record.target.className}` : ''}:${record.attributeName ?? ''}`)))
        .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    return page;
  }));
  const changed = Promise.all(watched.map((page) => page.evaluate(() => new Promise<void>((done) => {
    addEventListener('storage', (event) => {
      if (event.key === 'nbl:progress' && event.newValue?.includes('how-ai-works/tokens')) done();
    });
  }))));
  const finisher = await context.newPage();
  await finisher.goto(`${baseURL}/done/how-ai-works/tokens/`, { waitUntil: 'networkidle' });
  await changed;
  expect(await Promise.all(watched.map((page) => page.evaluate(() => (window as unknown as { changes: string[] }).changes)))).toEqual([[], [], [], []]);
  const currentCode = await finisher.locator('main .save-code .code').textContent();
  await watched[0].getByRole('button', { name: 'Settings' }).click();
  await expect(watched[0].locator('#settings .save-code .code')).toHaveText(currentCode ?? '');
  await watched[1].reload();
  await expect(watched[1].locator('[data-lesson="how-ai-works/tokens"]')).toHaveAttribute('data-state', 'done');
});
