import { expect, test } from 'vitest';
import config from '../../astro.config.mjs';
import { markExternal } from './external.ts';

test('an external link is marked, an own-site link is not', () => {
  const out = markExternal('<p><a href="https://a.eu/x" rel="noopener" class="k">out</a> <a href="/about/">in</a> <a href="//b.eu">cdn</a> <a>none</a></p>', config.site!);
  expect(out).toMatch(/<a href="https:\/\/a\.eu\/x" class="k" target="_blank" rel="noopener noreferrer">out<span class="new-tab" data-pagefind-ignore> \(opens in a new tab\)<\/span><\/a>/);
  expect(out).toContain('<a href="//b.eu" target="_blank"');
  expect(out).toContain('<a href="/about/">in</a> ');
  expect(out).toContain('<a>none</a>');
});

test('external decoration stays within the rendered HTML budget', () => {
  const links = '<a href="https://example.com/">Example</a>'.repeat(200);
  expect(Buffer.byteLength(markExternal(links, config.site!))).toBeLessThan(40_000);
});
