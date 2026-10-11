// The one count (plan T9.3, D11, Emanuel 10-10-26): the script path for any page with no query and no fragment, flag on.
import { expect, test } from 'vitest';
import { analyticsSrc } from './analytics.ts';

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

test('1 any path with nothing else gives the script path', () => {
  for (const path of ['/', '/learn/how-ai-works/a/', '/done/how-ai-works/a/', '/privacy/'])
    expect(analyticsSrc('1', at(path))).toBe('/_vercel/insights/script.js');
});

test('2 a path with #p=... gives nothing', () => {
  for (const path of ['/', '/done/how-ai-works/a/'])
    expect(analyticsSrc('1', at(path, '', '#p=NBL1-0000-0000-0000-0000-1N0F'))).toBeUndefined();
});

test('3 a path with ?x=1 gives nothing', () => {
  for (const path of ['/', '/done/how-ai-works/a/']) expect(analyticsSrc('1', at(path, '?x=1'))).toBeUndefined();
});

test('4 with the flag off, any path gives nothing', () => {
  for (const path of ['/', '/done/how-ai-works/a/']) expect(analyticsSrc(undefined, at(path))).toBeUndefined();
});
