// Makes one local 1200 by 630 PNG card for every signed lesson. No network is used.
import { spawnSync } from 'node:child_process';
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'js-yaml';
import { chromium } from '@playwright/test';
import { readContents } from '../src/contents.ts';

type Lesson = { id: string; number: string; pillar: string; title: string };
const file = (root: string, path: string) => pathToFileURL(resolve(root, path)).href;
const escape = (text: string) => text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);

export const lessons = (root = '.'): Lesson[] => {
  const built = globSync('content/*/*/index.mdx', { cwd: root }).map((path) => {
    const id = relative('content', path).replace('/index.mdx', '');
    const { title } = load(readFileSync(join(root, path), 'utf8').split('---')[1]) as { title: string };
    return { id, title };
  });
  return readContents(root).flatMap(({ slug, title: pillar, lessons: signed }) => signed.map(({ n: number, title }) => {
    const lesson = built.find((entry) => entry.id.split('/')[0] === slug && entry.title === title);
    if (!lesson) throw new Error(`${slug}: ${title} is not a lesson`);
    return { id: lesson.id, number, pillar, title };
  }));
};

const card = (root: string, lesson: Lesson) => `<style>
@font-face { font-family: Lexend; src: url(${file(root, 'public/fonts/lexend-latin-wght-normal.woff2')}); font-weight: 100 900; }
* { box-sizing: border-box; } body { margin: 0; width: 1200px; height: 630px; padding: 64px 76px 48px; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, #12162B, #172463 55%, #1E3A8A); color: white; font-family: Lexend, sans-serif; } p { margin: 0; } .name { font-size: 60px; line-height: 1.1; font-weight: 700; } .pillar { margin-top: 10px; color: #BFD5FF; font-size: 28px; font-weight: 600; } .number { margin-top: 42px; color: #BFD5FF; font-size: 32px; font-weight: 600; } h1 { max-width: 980px; margin: 12px 0 0; font-size: 72px; line-height: 1.12; letter-spacing: -1px; font-weight: 650; } img { width: 190px; height: auto; object-fit: contain; object-position: left bottom; }</style><div><p class="name">Stillpool</p><p class="pillar">${escape(lesson.pillar)}</p></div><div><p class="number">Lesson ${escape(lesson.number)}</p><h1>${escape(lesson.title)}</h1></div><img src="${file(root, 'public/brand/nbedu-logo-dark.png')}" alt="NeuroBridgeEDU">`;

export async function run(root = '.') {
  const dir = mkdtempSync(join(tmpdir(), 'share-'));
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const lesson of lessons(root)) {
      const cardPath = join(dir, `${lesson.number}.html`);
      const output = join(root, 'public/share', `${lesson.id}.png`);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(cardPath, card(root, lesson));
      await page.goto(pathToFileURL(cardPath).href);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: output });
      const compressed = spawnSync('pngquant', ['--quality=65-90', '--force', '--output', output, output]);
      if (compressed.status !== 0) throw new Error(`pngquant failed for ${lesson.id}`);
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
