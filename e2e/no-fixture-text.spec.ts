// No fixture text reaches the real site, with or without a real recording beside it (p5-pr11-review SHOULD-FIX 2).
import { globSync, readFileSync } from 'node:fs';
import { expect, test } from './guard.ts';

// The fixture's own text: its message, model, settings, instructions, replies and summary start "Test fixture".
const fixture = globSync('fixtures/recorded/*').map((f) => readFileSync(f, 'utf8')).join('\n');
const texts = fixture.match(/(?:Test fixture|test-fixture)[^"\n]*/g) ?? [];

test('dist holds no fixture text', () => {
  expect(texts.length).toBeGreaterThan(5);
  const leaked = globSync('dist/**/*.{html,js,json}').filter((f) => texts.some((t) => readFileSync(f, 'utf8').includes(t)));
  expect(leaked).toEqual([]);
});

test('recordings and built pages contain no keys, authorisation headers or account ids', () => {
  const secret = /sk-(?:ant|proj|live)-[A-Za-z0-9_-]{8,}|authorization["']?\s*[:=]\s*["']?bearer|bearer\s+[A-Za-z0-9_.-]{12,}|(?:x-api-key|api[_-]?key)["']?\s*[:=]\s*["']?\S{8,}|account[_-]?id["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{6,}/i;
  const files = [...globSync('data/recorded/*.json'), ...globSync('dist/**/*.{html,js,json}')];
  expect(files.length).toBeGreaterThan(3);
  for (const file of files) expect(readFileSync(file, 'utf8'), `${file} leaks a secret`).not.toMatch(secret);
});
