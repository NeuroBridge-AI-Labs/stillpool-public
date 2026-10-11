// The count (plan T9.4, D11, S3): the default build loads no analytics on any page, /done included, and holds no
// trace of the script path (a runtime test alone missed one: the first PR 9 build shipped the path, unused).
import { globSync, readFileSync } from 'node:fs';
import { pages } from '../checks/serve.ts';
import { expect, test } from './guard.ts';

// The directives of a page's CSP meta, and nothing else: a lesson may explain connect-src in words (3.3 does).
const cspDirectives = (html: string) =>
  (/<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(html)?.[1] ?? '').split(';').map((d) => d.trim().split(/\s+/)[0]).filter(Boolean);

test('the connect-src check reads the CSP directives, not the prose around them', () => {
  const policy = (extra: string) => `<meta http-equiv="content-security-policy" content="default-src 'none'; img-src 'self'${extra}">`;
  expect(cspDirectives(`<p>The connect-src directive is not set.</p>${policy('')}`)).not.toContain('connect-src');
  expect(cspDirectives(policy("; connect-src 'self'"))).toContain('connect-src');
});

test('in the default build no page requests anything under /_vercel/, and only the practice lab and the feedback page may connect', async ({ page }) => {
  test.setTimeout(120_000); // every route, networkidle each: 30 s was the edge once the Ethics lessons landed
  const shipped = globSync('dist/**/*.{html,js}').filter((f) => readFileSync(f, 'utf8').includes('_vercel/insights'));
  expect(shipped).toEqual([]);
  // Only an analytics build may connect (D11), the practice lab and the feedback page, each for its own server function (lab-spec F);
  // pr9-review SHOULD-FIX 1: nothing else failed when every build did. Any second page fails.
  const connects = globSync('dist/**/*.html').filter((f) => cspDirectives(readFileSync(f, 'utf8')).includes('connect-src')).sort();
  expect(connects, 'connect-src in the default build: the practice lab and the feedback page only').toEqual(['dist/feedback/index.html', 'dist/lab/index.html']);
  const asked: string[] = [];
  page.on('request', (r) => new URL(r.url()).pathname.startsWith('/_vercel/') && asked.push(r.url()));
  const routes = pages('dist');
  expect(routes.some((route) => route.startsWith('/done/'))).toBe(true);
  for (const route of routes) await page.goto(route, { waitUntil: 'networkidle' });
  expect(asked).toEqual([]);
});
