// Browser parsing covers quoted and unquoted attributes. Native accessible-name checks hold every external link
// to one warning, including links in reading layers and activities that the learner can reveal.
import { chromium, expect } from '@playwright/test';
import config from '../astro.config.mjs';
import { pages, serve } from './serve.ts';

const NAME = 'links';
const WARNING = /^(?:(?!\(opens in a new tab\))[\s\S])*\(opens in a new tab\)(?:(?!\(opens in a new tab\))[\s\S])*$/;
const findings: string[] = [];
const site = new URL(config.site!);
const browser = await chromium.launch();
try {
  for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
    const urls = pages(target);
    if (!urls.length) {
      findings.push(`${NAME}: nothing to check in ${target}`);
      continue;
    }
    const { origin, close } = await serve(target);
    const tab = await browser.newPage();
    try {
      await tab.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      for (const page of urls) {
        await tab.goto(origin + page, { waitUntil: 'networkidle' });
        // Reveal ancestors, never link descendants: aria-hidden on a warning must still fail.
        await tab.evaluate(() => {
          for (const link of document.querySelectorAll('a[href]'))
            for (let el = link.parentElement; el; el = el.parentElement) {
              el.hidden = false;
              el.removeAttribute('inert');
              el.removeAttribute('aria-hidden');
              el.style.setProperty('display', 'block', 'important');
              el.style.setProperty('visibility', 'visible', 'important');
              if (el instanceof HTMLDetailsElement) el.open = true;
            }
        });
        const links = tab.locator('a[href]');
        for (let i = 0; i < await links.count(); i++) {
          const link = links.nth(i);
          const attrs = await link.evaluate((a) => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'),
            rel: a.getAttribute('rel') ?? '', iconExposed: [...a.querySelectorAll('svg')].some((svg) => svg.getAttribute('aria-hidden') !== 'true'),
            // The icon is CSS on a:has(> .new-tab)::after (global.css), so a warning without the class has no visible cue.
            hasIcon: !!a.querySelector(':scope > .new-tab') }));
          const prefix = `${NAME}: ${page}: ${attrs.href}: `;
          let url: URL;
          try { url = new URL(attrs.href, new URL(page, site)); }
          catch { findings.push(prefix + 'unreadable href'); continue; }
          if (!['http:', 'https:'].includes(url.protocol)) continue;
          if (url.origin === site.origin) {
            if (attrs.target === '_blank') findings.push(prefix + 'a link within the site opens a new tab');
            continue;
          }
          if (attrs.target !== '_blank') findings.push(prefix + 'no target="_blank"');
          if (!attrs.rel.toLowerCase().split(/[\t\n\f\r ]+/).includes('noopener')) findings.push(prefix + 'no rel="noopener"');
          const named = await expect(link).toHaveAccessibleName(WARNING, { timeout: 1 }).then(() => true, () => false);
          if (!named) findings.push(prefix + 'accessible name must contain "(opens in a new tab)" exactly once');
          else if (!attrs.hasIcon) findings.push(prefix + 'no visible new-tab icon: the warning span needs class="new-tab"');
          if (attrs.iconExposed) findings.push(prefix + 'icon is not aria-hidden="true"');
        }
      }
    } finally {
      await tab.close();
      await close();
    }
  }
} finally {
  await browser.close();
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
