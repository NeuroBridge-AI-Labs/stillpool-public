import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import config from '../astro.config.mjs';
import { markExternal } from '../src/lib/external.ts';

for (const name of ['rel-token', 'hidden-warning', 'label-override', 'duplicate-warning', 'exposed-icon', 'no-icon', 'unquoted', 'own-origin'])
  test(`links regression: ${name}`, () => {
    const r = spawnSync(process.execPath, ['checks/links.ts', `fixtures/bad/links/${name}`], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('links:');
  }, 30_000);

test('same-origin web links and non-web schemes are left alone', () => {
  for (const href of ['https://learn.neurobridgeedu.eu/about/', '//learn.neurobridgeedu.eu/about/', '/about/', 'mailto:hello@example.com', 'tel:+353123']) {
    const html = `<a href="${href}">Visit</a>`;
    expect(markExternal(html, config.site!)).toBe(html);
  }
});

test('the company website is external', () => {
  expect(markExternal('<a href="https://neurobridgeedu.eu">Company</a>', config.site!)).toContain('target="_blank"');
});
