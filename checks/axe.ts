// check:axe. Every page under <target>, in every [data-theme] of src/styles/tokens.css (zero themes fails), passes
// axe-core with the WCAG 2.2 rules turned on.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import axe from 'axe-core';
import { pages, serve } from './serve.ts';

const NAME = 'axe';
const TOKENS = 'src/styles/tokens.css';
// axe-core 4.13.0 ships its only WCAG 2.2 rule, target-size, disabled. Measured: these tags run the 89 default rules
// plus target-size, since axe leaves 'experimental' and 'deprecated' rules out of a tag run unless those tags are named.
const RUN_ONLY = { type: 'tag' as const, values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] };

const findings: string[] = [];
let violations = 0;
const css = existsSync(TOKENS) ? readFileSync(TOKENS, 'utf8') : ''; // no file means no themes, which fails below
const themes = [...css.matchAll(/\[data-theme="([^"]*)"\]/g)].map(([, theme]) => theme);
if (!themes.length) findings.push(`${NAME}: no [data-theme] in ${TOKENS}`);
let ok = themes.length > 0;

for (const target of ok ? (process.argv.length > 2 ? process.argv.slice(2) : ['dist']) : []) {
  const urls = pages(target);
  if (!urls.length) {
    findings.push(`${NAME}: nothing to check in ${target}`);
    ok = false;
    continue;
  }
  const { origin, close } = await serve(target);
  const browser = await chromium.launch();
  try {
    // Reduced motion, so a colour transition set off by the theme switch below has ended before axe reads the colours
    // (measured: under load, the header's Settings button was read half-way, at 1.03:1).
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    for (const url of urls)
      for (const theme of themes) {
        await page.goto(origin + url, { waitUntil: 'networkidle' });
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        // page.evaluate is not subject to the page's CSP, so no bypassCSP, which would change what renders.
        await page.evaluate(axe.source);
        const found = (await page.evaluate((opts) => axe.run(opts), { runOnly: RUN_ONLY })).violations;
        findings.push(...found.map((v) => `${NAME}: ${url} [${theme}]: ${v.id}`));
        violations += found.length;
      }
  } finally {
    await browser.close();
    await close();
  }
}

if (ok) console.log(`violations: ${violations}`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
