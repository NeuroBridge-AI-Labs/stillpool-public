// check:privacy. Serve <target> and visit every page in one Chromium context: a request to any other origin is
// counted, then aborted, so nothing leaves the machine even on the bad fixture. Then count the cookies left behind.
import { chromium } from '@playwright/test';
import { pages, serve } from './serve.ts';

const NAME = 'privacy';
const findings: string[] = [];
let requests = 0;
let cookies = 0;
let ok = true;

for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
  const urls = pages(target);
  if (!urls.length) {
    findings.push(`${NAME}: nothing to check in ${target}`);
    ok = false;
    continue;
  }
  const { origin, close } = await serve(target);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (new URL(url).origin === origin) return route.continue();
      requests += 1;
      findings.push(`${NAME}: third-party request: ${url}`);
      return route.abort();
    });
    const page = await context.newPage();
    // ponytail: this visits every page and plays each of Emma's audio files (Read aloud, where a part has one); every
    // other interaction is covered by the e2e guard (e2e/guard.ts, S2).
    for (const url of urls) {
      await page.goto(origin + url, { waitUntil: 'networkidle' });
      for (const read of await page.locator('.read:has(audio) [data-read="start"]').all()) await read.click();
      await page.waitForLoadState('networkidle');
    }
    for (const { name } of await context.cookies()) {
      cookies += 1;
      findings.push(`${NAME}: cookie: ${name}`);
    }
  } finally {
    await browser.close();
    await close();
  }
}

if (ok) console.log(`third-party requests: ${requests}  cookies: ${cookies}`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
