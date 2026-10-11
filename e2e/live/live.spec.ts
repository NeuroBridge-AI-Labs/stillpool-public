// The live probe (plan PR 12, ADR 0003), run by playwright.live.config.ts against a deployed LIVE_URL. Under the guard,
// so a script the host injects (Vercel's preview toolbar) or any other request off the site fails it too.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, type Page, test } from '../guard.ts';

// ADR 0003's list, written out here and never read from vercel.json, so a wrong vercel.json cannot pass itself.
const HEADERS = {
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'strict-transport-security': 'max-age=63072000',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
const CODE = 'NBL1-G000-0000-4000-0000-0T5D'; // D8: slot 0 finished and badged

test('every page loads with the deploy headers and no console error', async ({ page }) => {
  const seen = new Set(['/']);
  // Every page a visitor can reach from /: a Set visits what is added while it is iterated.
  for (const path of seen) {
    test.setTimeout(30_000 + seen.size * 2_000); // the walk is one test: allow about 2 s a page found so far, as the site grows
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(response?.headers(), path).toMatchObject(HEADERS);
    const links = await page.locator('a[href^="/"]:not([href^="//"])').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    for (const link of links) if (link.endsWith('/')) seen.add(link);
  }
  expect([...seen].some((path) => path.startsWith('/done/')), 'a /done page was reached').toBe(true);
});

test('search finds the lesson, and Pagefind gets no CSP but frame-ancestors (F6)', async ({ page, context }) => {
  const policies: string[] = [];
  context.on('response', (r) => new URL(r.url()).pathname.startsWith('/pagefind/') && policies.push(r.headers()['content-security-policy']));
  await page.goto('/search/');
  await page.getByRole('combobox', { name: 'Search the lessons' }).fill('patterns');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Results' }).getByRole('link').first()).toHaveAttribute('href', /^\/learn\/.+\/$/);
  expect(policies.length).toBeGreaterThan(0);
  expect(new Set(policies)).toEqual(new Set([HEADERS['content-security-policy']]));
});

test('S3: the count never carries a save code, and /done opened with #p= sends nothing', async ({ page, context, baseURL }) => {
  let asked: { url: string; method: string; body: string | null }[] = [];
  context.on('request', (r) => new URL(r.url()).pathname.startsWith('/_vercel/insights/') && asked.push({ url: r.url(), method: r.method(), body: r.postData() }));
  const restored = (p: Page) => expect(p.locator('#restore-status')).toHaveText('Your progress is back on this device.');

  await page.goto(`/#p=${CODE}`);
  await restored(page);
  const done = ((await page.locator('main a[href^="/learn/"]').first().getAttribute('href')) ?? '').replace(/^\/learn\//, '/done/');
  await page.goto(done, { waitUntil: 'networkidle' });
  // The script alone is not the count: wait for what it sends.
  await expect.poll(() => asked.filter((r) => !r.url.endsWith('/script.js')).length, 'a count was sent').toBeGreaterThan(0);
  // The real script ran, and the one field that could carry the code is the bare /done address.
  expect(JSON.parse(asked.find((r) => !r.url.endsWith('/script.js'))?.body ?? '{}').o).toBe(new URL(done, baseURL).href);
  // Only a deploy is recorded, so a local run never leaves stub data where the real recording goes, and only when asked
  // (RECORD=1), so a routine live run never rewrites the committed file (p404 handoff).
  if (baseURL?.startsWith('https://') && process.env.RECORD === '1') {
    mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../fixtures/analytics-request.json', import.meta.url), `${JSON.stringify(asked, null, 2)}\n`);
  }
  for (const r of asked) expect(`${r.url} ${r.body}`).not.toMatch(/nbl1|p=/i);

  asked = [];
  // A new page, so this is a full load: on the same page, only the fragment would change and /done's script would not run.
  const direct = await context.newPage();
  await direct.goto(`${done}#p=${CODE}`, { waitUntil: 'networkidle' });
  expect(asked).toEqual([]); // two layers: analytics.ts refuses a hash, and restore.ts sends the link on to /
  await restored(direct);
});

// Passes only once Vercel Web Analytics is enabled for the project (EMMI, Vercel dashboard): until then the path is a 404.
test('Vercel serves the count script from this origin, as JavaScript', async ({ request }) => {
  const response = await request.get('/_vercel/insights/script.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/javascript/);
});

test('no X-Robots-Tag header on HTML responses, a missing page included', async ({ request }) => {
  for (const [path, status] of [['/', 200], ['/no-such-page/', 404]] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    expect(response.headers()['content-type'], path).toMatch(/^text\/html/);
    expect(response.headers()['x-robots-tag'], path).toBeUndefined();
  }
});
