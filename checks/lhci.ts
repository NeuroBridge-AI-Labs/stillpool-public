// check:lhci. Every page under <target> scores accessibility 1 and passes every seo audit but robots-txt, and scores performance and best practices 0.9 or more, with
// cumulative layout shift 0.1 or less and total blocking time 200 ms or less (Lighthouse's Node API, full Chromium).
import { readFileSync } from 'node:fs';
import { type AddressInfo, createServer } from 'node:net';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { isNoindex } from './noindex.ts';
import { pages, serve } from './serve.ts';

const NAME = 'lhci';
const MIN_SCORE = { accessibility: 1, performance: 0.9, 'best-practices': 0.9 };
// The page's CSP (default-src 'none', nothing leaves the device) blocks the fetch Lighthouse's robots-txt audit makes, so that audit cannot pass here; check:seo proves robots.txt and every canonical.
const SEO_SKIPPED = ['robots-txt'];
const CLS_MAX = 0.1;
const TBT_MAX = 200; // ms

const timing = (lhr: NonNullable<Awaited<ReturnType<typeof lighthouse>>>['lhr']) => ({
  performance: lhr.categories.performance.score ?? 0,
  cls: lhr.audits['cumulative-layout-shift'].numericValue ?? 0,
  tbt: Math.round(lhr.audits['total-blocking-time'].numericValue ?? 0),
});
const breaks = (t: ReturnType<typeof timing>) => t.performance < MIN_SCORE.performance || t.cls > CLS_MAX || t.tbt > TBT_MAX;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// A free port for Chrome's debugging protocol, which Lighthouse drives.
const freePort = () =>
  new Promise<number>((done) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => done(port));
    });
  });

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
  const paths = pages(target);
  if (!paths.length) {
    findings.push(`${NAME}: nothing to check in ${target}`);
    continue;
  }
  const { origin, close } = await serve(target);
  const port = await freePort();
  const flags = { port, output: 'json' as const, logLevel: 'silent' as const, onlyCategories: [...Object.keys(MIN_SCORE), 'seo'] };
  const browser = await chromium.launch({ channel: 'chromium', args: [`--remote-debugging-port=${port}`] });
  try {
    for (const page of paths) {
      // ponytail: one run per page. A first run that breaks a timing limit (performance, CLS, TBT) is measured twice more and the median of three is judged, because a loaded machine flaps those; accessibility, best practices and seo are judged on the first run.
      const lhr = (await lighthouse(`${origin}${page}`, flags))?.lhr;
      if (!lhr || lhr.runtimeError) {
        findings.push(`${NAME}: ${page}: runtime error ${lhr?.runtimeError?.code ?? 'no result'}`);
        continue;
      }
      // A noindex page (decided as check:seo decides it, in the head) fails Lighthouse's is-crawlable by design, so it skips the seo score and only that one.
      const noindex = isNoindex(readFileSync(join(target, page.endsWith('/') ? `${page}index.html` : page), 'utf8'));
      let t = timing(lhr);
      const retry = breaks(t);
      if (retry) {
        const runs = [t];
        for (let i = 0; i < 2; i++) {
          const again = (await lighthouse(`${origin}${page}`, flags))?.lhr;
          if (again && !again.runtimeError) runs.push(timing(again));
        }
        t = { performance: median(runs.map((r) => r.performance)), cls: median(runs.map((r) => r.cls)), tbt: median(runs.map((r) => r.tbt)) };
      }
      const scores = Object.entries(MIN_SCORE).map(([id, min]) => [id, id === 'performance' ? t.performance : (lhr.categories[id].score ?? 0), min] as const);
      for (const [id, score, min] of scores) if (score < min) findings.push(`${NAME}: ${page}: ${id} ${score} < ${min}`);
      if (!noindex)
        for (const { id } of lhr.categories.seo.auditRefs)
          if (!SEO_SKIPPED.includes(id) && (lhr.audits[id].score ?? 1) < 1) findings.push(`${NAME}: ${page}: seo audit ${id} failed`);
      const { cls, tbt } = t;
      if (cls > CLS_MAX) findings.push(`${NAME}: ${page}: cumulative-layout-shift ${cls} > ${CLS_MAX}`);
      if (tbt > TBT_MAX) findings.push(`${NAME}: ${page}: total-blocking-time ${tbt} ms > ${TBT_MAX} ms`);
      console.log(`${NAME}: ${page}: ${[...scores.map(([id, score]) => `${id} ${score}`), ...(noindex ? [] : [`seo ${lhr.categories.seo.score}`])].join(', ')}, CLS ${cls}, TBT ${tbt} ms${retry ? ' (median of 3)' : ''}`);
    }
  } finally {
    await browser.close();
    await close();
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
