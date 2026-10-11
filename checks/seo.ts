// check:seo. Per *.html page under <target>: an indexable page has a description of 50 to 160 characters, a title of 10 to
// 65 that no other indexable page uses, one canonical equal to its own address, the Open Graph and card tags, parsing
// JSON-LD, and no banned text in its head. A page under /learn/ carries a LearningResource joined to the course and the
// organisation; the home page carries the four ids of the shared graph. 404.html and every page under /done/ and /search/
// is noindex and has no canonical; no other page is noindex. The real site (a target named dist) and any target holding
// a sitemap.xml, robots.txt or share.png also get the crawl-file rules: sitemap.xml exists and every <loc> is an indexable
// page, every indexable page is listed, robots.txt exists, names exactly the sitemap and blocks nothing, share.png exists.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { attr, headOf, isNoindex } from './noindex.ts';

const NAME = 'seo';
const HOST = 'https://learn.neurobridgeedu.eu';
const COURSE = `${HOST}/#course`;
const ORG = 'https://www.neurobridgeedu.eu/#organization';
const HOME_IDS = [`${HOST}/#website`, COURSE, ORG, 'https://emmi.zone/#person'];
const BANNED = /NeuroBridge\s+AI\s+Labs|MayArt|(?:Time|Cyber|Task|Prompt|Electro|Math)Sage|twitter:site|twitter:creator|\bx\.com\/|twitter\.com\//i;

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
  const pages = globSync('**/*.html', { cwd: target }).sort();
  if (!pages.length) findings.push(`${NAME}: nothing to check in ${target}`);
  const titles = new Map<string, string>();
  const indexable = new Set<string>();
  const crawl = basename(target) === 'dist' || ['sitemap.xml', 'robots.txt', 'share.png'].some((f) => existsSync(join(target, f)));
  for (const html of pages) {
    const page = `/${html.replace(/(^|\/)index\.html$/, '$1')}`;
    const text = readFileSync(join(target, html), 'utf8');
    const head = headOf(text);
    const fail = (reason: string) => findings.push(`${NAME}: ${page}: ${reason}`);
    const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag);
    const meta = (key: string) => {
      const tag = metas.find((t) => attr(t, 'property') === key || attr(t, 'name') === key);
      return tag && (attr(tag, 'content') ?? '');
    };
    const canonicals = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag).filter((t) => attr(t, 'rel') === 'canonical').map((t) => attr(t, 'href'));
    const noindex = isNoindex(text);

    const banned = BANNED.exec(head)?.[0];
    if (banned) fail(`banned text in head: ${banned}`);

    const nodes: Record<string, unknown>[] = [];
    for (const [, body] of text.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const json = JSON.parse(body);
        nodes.push(...(json['@graph'] ?? [json]));
      } catch {
        fail('JSON-LD does not parse');
      }
    }
    const idOf = (v: unknown) => (v as { '@id'?: string } | undefined)?.['@id'];

    const hidden = page === '/404.html' || /^\/(?:done|search)\//.test(page);
    if (hidden && !noindex) fail('must be noindex');
    if (!hidden && noindex) fail('noindex on an indexable page');
    if (noindex) {
      if (canonicals.length) fail('noindex page has a canonical');
      continue;
    }
    indexable.add(page);
    if (crawl && !existsSync(join(target, 'share.png'))) fail('og:image file missing');

    const description = meta('description');
    if (description === undefined || description.length < 50 || description.length > 160) fail('description missing or not 50 to 160 characters');
    const title = /<title>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '';
    if (title.length < 10 || title.length > 65) fail('title not 10 to 65 characters');
    const first = titles.get(title);
    if (first) fail(`title repeats ${first}`);
    else titles.set(title, page);

    const expected = `${HOST}${page}`;
    if (canonicals.length !== 1 || canonicals[0] !== expected) fail(`canonical is ${canonicals.join(' ') || 'missing'}, expected ${expected}`);

    for (const key of ['og:title', 'og:description', 'og:type', 'og:site_name', 'twitter:card']) if (!meta(key)) fail(`missing ${key}`);
    for (const [key, want] of [['og:url', expected], ['og:image', page.startsWith('/learn/') ? `${HOST}/share/${page.slice('/learn/'.length, -1)}.png` : `${HOST}/share.png`]]) {
      const got = meta(key);
      if (got === undefined) fail(`missing ${key}`);
      else if (got !== want && !(key === 'og:image' && page.startsWith('/learn/') && got === `${HOST}/share.png`)) fail(`${key} is ${got}, expected ${want}`);
    }

    if (page.startsWith('/learn/')) {
      const ogImage = meta('og:image');
      if (ogImage === `${HOST}/share.png`) fail('og:image is https://learn.neurobridgeedu.eu/share.png, expected a lesson share image');
      if (ogImage && ogImage !== `${HOST}/share.png` && !existsSync(join(target, ogImage.replace(HOST, '')))) fail('lesson share image file missing');
      const imageMeta: [string, string | undefined][] = [['twitter:image', ogImage], ['og:image:width', '1200'], ['og:image:height', '630']];
      for (const [key, want] of imageMeta) if (meta(key) !== want) fail(`${key} is missing or wrong`);
      if (!meta('og:image:alt')) fail('og:image:alt missing');
    }

    if (page.startsWith('/learn/') && !nodes.some((n) => n['@type'] === 'LearningResource' && idOf(n.isPartOf) === COURSE && idOf(n.publisher) === ORG))
      fail('no LearningResource joined to the course and the organisation');
    if (page === '/') for (const id of HOME_IDS) if (!nodes.some((n) => n['@id'] === id)) fail(`missing @id ${id}`);
  }
  if (!crawl) continue;
  const read = (f: string) => (existsSync(join(target, f)) ? readFileSync(join(target, f), 'utf8') : undefined);
  const sitemap = read('sitemap.xml');
  if (sitemap === undefined) findings.push(`${NAME}: sitemap.xml: missing`);
  else {
    const listed = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    for (const loc of listed) if (!indexable.has(loc.replace(HOST, ''))) findings.push(`${NAME}: sitemap.xml: ${loc} has no indexable page`);
    for (const page of indexable) if (!listed.includes(`${HOST}${page}`)) findings.push(`${NAME}: ${page}: not in sitemap.xml`);
  }
  const robots = read('robots.txt');
  if (robots === undefined) findings.push(`${NAME}: robots.txt: missing`);
  else {
    const line = /^Sitemap:[ \t]*(\S*)/im.exec(robots)?.[1];
    if (!line) findings.push(`${NAME}: robots.txt: no Sitemap line`);
    else if (line !== `${HOST}/sitemap.xml`) findings.push(`${NAME}: robots.txt: Sitemap line is ${line}, expected ${HOST}/sitemap.xml`);
    if (/^Disallow:[ \t]*\/[ \t]*$/im.test(robots)) findings.push(`${NAME}: robots.txt: Disallow line blocks the whole site`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
