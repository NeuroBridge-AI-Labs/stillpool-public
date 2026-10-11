// Polish U3 to U6: the footer's links, the About page, and licences and credits as a styled page made from the same
// text file that is still served at /licences.txt.
import { readdirSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from './guard.ts';

test('the footer links NeuroBridgeEDU and Emanuel Covasa out, and opens About and the licences page', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  for (const [name, href] of [
    ['NeuroBridgeEDU', 'https://neurobridgeedu.eu'],
    ['Emanuel Covasa', 'https://emmi.zone'],
  ] as const) {
    const link = footer.getByRole('link', { name: `${name} (opens in a new tab)`, exact: true }).last();
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('target', '_blank');
  }
  await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about/');
  await expect(footer.getByRole('link', { name: 'Licences and credits' })).toHaveAttribute('href', '/licences/');
});

test('About says what Stillpool is, how lessons are checked and who made it, and links the lesson licence text', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About Stillpool');
  const main = page.locator('main');
  const said = (await main.innerText()).replace(/\s+/g, ' ');
  expect(said).not.toContain('The first three are open now');
  expect(said).toContain('Emanuel Covasa then reads every lesson before it is published.');
  expect(said).toContain("NeuroBridgeEDU isn't just software – it's a bridge to a future where education works for everyone.");
  expect(said).toContain('Luc Dober');
  expect(said).toContain('Co-founder · Education');
  expect(said).toContain('The lessons do not promote NeuroBridgeEDU');
  await expect(main.getByRole('link', { name: 'contact@neurobridgeedu.eu' })).toHaveAttribute('href', 'mailto:contact@neurobridgeedu.eu');
  await expect(main.getByRole('link', { name: 'Emanuel Covasa (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://emmi.zone');
  await expect(main.getByRole('link', { name: 'CC BY-NC-SA 4.0 (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  expect(await main.innerText()).toContain('all rights reserved');
  await expect(main.getByRole('link', { name: 'public on GitHub (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://github.com/NeuroBridge-AI-Labs/stillpool-public');
  expect(await main.innerText()).not.toContain('—');
});

test('licences and credits is a page with its heading, built from licences.txt, called Stillpool', async ({ page, request }) => {
  await page.goto('/licences/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Licences for what this site ships');
  const text = await (await request.get('/licences.txt')).text();
  const shown = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(shown).not.toMatch(/working title|NBEDU AI Literacy/);
  expect(text).not.toMatch(/working title|NBEDU AI Literacy/);
  const packages = text.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(',')[0]);
  expect(packages.length).toBeGreaterThan(5);
  for (const name of packages) expect(shown, name).toContain(name);
  await expect(page.locator('main').getByRole('link', { name: 'https://www.apache.org/licenses/LICENSE-2.0' })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'public on GitHub (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://github.com/NeuroBridge-AI-Labs/stillpool-public');
  await expect(page.locator('main a[href="https://github.com/NeuroBridge-AI-Labs/stillpool-public"]'), 'one visible link to the source').toHaveCount(1);
  expect(shown).toContain('stillpool-public');
  expect(shown).toContain('Dubliners');
  expect(shown).not.toContain('private for now');
});

// The teachers page: every number on it is read from the lessons' own files (content/<pillar>/<lesson>/index.mdx), not from the map it is built from.
test('For teachers shows the pillar counts and times the lesson files have, in sentences of 20 words or fewer', async ({ page }) => {
  const map = load(readFileSync('content/map.yaml', 'utf8')) as { id: string; title: string }[];
  const minutes = (pillar: string, lesson: string) =>
    (load(/^---\n([\s\S]*?)\n---/.exec(readFileSync(`content/${pillar}/${lesson}/index.mdx`, 'utf8'))?.[1] ?? '') as { minutes: { simple: number; deep: number } }).minutes;
  const lessons = map.map((p) => ({ ...p, slugs: readdirSync(`content/${p.id}`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) }));
  const all = lessons.flatMap((p) => p.slugs.map((slug) => minutes(p.id, slug)));
  const [simple, deep] = [all.map((m) => m.simple), all.map((m) => m.deep)];
  await page.goto('/teachers/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('For teachers');
  const main = page.locator('main');
  for (const p of lessons) {
    const item = main.locator('li', { has: page.locator(`a[href="/#pillar-${p.id}"]`) });
    await expect(item, p.title).toContainText(`${p.slugs.length} ${p.slugs.length === 1 ? 'lesson' : 'lessons'}`);
  }
  const said = (await main.innerText()).replace(/[ \t]+/g, ' ');
  expect(said).toContain(`${lessons.reduce((n, p) => n + p.slugs.length, 0)} lessons`);
  expect(said).toContain(`from ${Math.min(...simple)} to ${Math.max(...simple)} minutes`);
  expect(said).toContain(`from ${Math.min(...deep)} to ${Math.max(...deep)} minutes`);
  expect(said).not.toContain('\u2014');
  // A badge needs every check-in step and Focus mode leaves Settings and the header (src/progress/store.ts, src/styles/settings.css).
  expect(said).toContain('A badge earned on the projector stays in that browser only.');
  for (const gone of ['earns the badge', 'hides everything', 'nothing times or counts']) expect(said).not.toContain(gone);
  for (const sentence of said.split(/(?<=[.!?])\s+|\n+/)) expect(sentence.split(/\s+/).filter(Boolean).length, sentence).toBeLessThanOrEqual(20);
  await page.goto('/about/');
  await expect(page.locator('main').getByRole('link', { name: 'For teachers' })).toHaveAttribute('href', '/teachers/');
});
