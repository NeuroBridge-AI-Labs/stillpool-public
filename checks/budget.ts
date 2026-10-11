// check:budget. Per *.html page under <target>: the HTML plus its linked local CSS is 60 KB gzip or less, and its eager
// JS (the static-import closure of its scripts, module preloads and island URLs) is 80 KB gzip or less and loads no
// tokenizer chunk. Across the target, font files total 250 KB or less. A named local file that is missing fails.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const NAME = 'budget';
const PAGE_MAX_KB = 60;
const JS_MAX_KB = 80;
const FONTS_MAX_KB = 250;

const kb = (bytes: number) => (bytes / 1024).toFixed(1);
const gz = (file: string) => gzipSync(readFileSync(file)).length;
const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag)?.[2];
const local = (url: string | undefined): url is string => !!url && !/^(?:[a-z]+:|\/\/)/i.test(url);
// Static imports only: import"x", import{a}from"x", export*from"x". A dynamic import("x") is not followed.
const imports = (js: string) =>
  [...js.matchAll(/\bimport\s*(["'])(.*?)\1|\b(?:import|export)\b[^"';]*?\bfrom\s*(["'])(.*?)\3/g)].map((m) => m[2] ?? m[4]);

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
  const pages = globSync('**/*.html', { cwd: target }).sort();
  if (!pages.length) findings.push(`${NAME}: nothing to check in ${target}`);
  for (const html of pages) {
    const page = `/${html.replace(/(^|\/)index\.html$/, '$1')}`;
    const file = join(target, html);
    const text = readFileSync(file, 'utf8');
    // A root-relative URL resolves against the target, any other against the file that names it.
    const resolve = (url: string, from: string) => join(url.startsWith('/') ? target : dirname(from), url.replace(/[?#].*$/, ''));
    const missing = (f: string) => {
      if (existsSync(f)) return false;
      findings.push(`${NAME}: ${page}: missing ${relative(target, f)}`);
      return true;
    };

    let pageBytes = gz(file);
    const seeds: string[] = [];
    for (const [tag] of text.matchAll(/<link\b[^>]*>/gi)) {
      const [rel, href] = [attr(tag, 'rel')?.toLowerCase(), attr(tag, 'href')];
      if (!local(href)) continue;
      if (rel === 'modulepreload') seeds.push(href);
      if (rel === 'stylesheet' && !missing(resolve(href, file))) pageBytes += gz(resolve(href, file));
    }
    if (pageBytes > PAGE_MAX_KB * 1024) findings.push(`${NAME}: ${page}: HTML+CSS ${kb(pageBytes)} KB gz > ${PAGE_MAX_KB} KB`);

    for (const [, attrs, body] of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = attr(attrs, 'src');
      if (src) seeds.push(src);
      else if (attr(attrs, 'type') === 'module') seeds.push(...imports(body));
    }
    for (const [tag] of text.matchAll(/<astro-island\b[^>]*>/gi))
      for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) seeds.push(attr(tag, name) ?? '');

    // ponytail: the tokenizer rule relies on src/lib/tokenizer.ts being reached through a dynamic import(), which gives
    // it its own tokenizer.*.js chunk; a static import merged into another chunk is caught by the 80 KB rule instead.
    // A Set visits what is added while it is walked, once each: the closure, deduplicated.
    const closure = new Set(seeds.filter(local).map((url) => resolve(url, file)));
    let jsBytes = 0;
    for (const js of closure) {
      if (missing(js)) continue;
      if (basename(js).startsWith('tokenizer')) findings.push(`${NAME}: ${page}: tokenizer loaded eagerly (${relative(target, js)})`);
      jsBytes += gz(js);
      for (const url of imports(readFileSync(js, 'utf8')).filter(local)) closure.add(resolve(url, js));
    }
    if (jsBytes > JS_MAX_KB * 1024) findings.push(`${NAME}: ${page}: JS ${kb(jsBytes)} KB gz > ${JS_MAX_KB} KB`);
  }
  const fonts = globSync('**/*.{woff2,woff,ttf,otf}', { cwd: target }).reduce((n, f) => n + readFileSync(join(target, f)).length, 0);
  if (fonts > FONTS_MAX_KB * 1024) findings.push(`${NAME}: fonts ${kb(fonts)} KB > ${FONTS_MAX_KB} KB`);
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
