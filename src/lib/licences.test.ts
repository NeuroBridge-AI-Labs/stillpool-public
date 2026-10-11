import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blocks, pieces } from './licences.ts';

test('blocks joins wrapped lines and folds an item with its continuation lines', () => {
  expect(blocks('Head one\ncontinues\n\nPackages:\n- a 1\n  more\n- b 2')).toEqual([
    { text: 'Head one continues', items: [] },
    { text: 'Packages:', items: ['a 1 more', 'b 2'] },
  ]);
});

test('pieces links an address and leaves its closing punctuation out of the link', () => {
  expect(pieces('see (https://x.org/a) and https://y.org/b. Done')).toEqual([
    { text: 'see (' },
    { text: 'https://x.org/a', href: 'https://x.org/a' },
    { text: ') and ' },
    { text: 'https://y.org/b', href: 'https://y.org/b' },
    { text: '. Done' },
  ]);
});

test('the real file has no text that blocks cannot place', () => {
  const all = blocks(readFileSync('public/licences.txt', 'utf8'));
  expect(all.length).toBeGreaterThan(5);
  expect(all.flatMap((b) => [b.text, ...b.items]).join(' ')).not.toContain('\n');
});
