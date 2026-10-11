// check:stillness. With no input for 10 s after load, no page under <target> changes its DOM, runs an animation,
// scrolls, or changes a pixel of the whole page, with the device's motion setting left alone and with it set to reduce:
// nothing moves by itself (R4 P6). Pixels catch what the others cannot see: SMIL, canvas, an inner scroller, a finite
// animation still running when sampling starts. A full-page frame is drawn from the top, so the page's own scroll is
// counted by a listener instead.
// Pages open in batches (PER_BATCH per mode, both modes at once), so the wait is paid once per batch.
// Pool Band v2 (Emanuel, 04-10-26, a loop since 05-10-26) allows one idle loop: the comet of light that runs round the Start
// button's edge. It is exempt only with the device's motion setting left alone, only as one CSS animation named orbit on
// `.start .orbit-light`, and it is hidden while the pixels are compared, so everything else on the page must still hold
// still. Set to reduce, it is no exception: it must be still too. A second orbit, or any other loop, fails.
// Home video corners (Emanuel, 05-10-26) is the second exception, on the same terms: a light runs along each of the two
// corner arcs, as a loop (CSS animation named drift on `.deco.tr` and `.deco.bl` directly inside the home video's
// `.media .surface`), exempt only with the motion setting left alone and hidden while the pixels are compared. Set to
// reduce they must be still. More than two such arcs, any on a page other than `/`, or any other element that drifts (even
// once, finished before the last sample) fails.
const ORBIT = '.start .orbit-light';
const CORNERS = '.media > .surface > .deco.tr, .media > .surface > .deco.bl';
const HIDDEN = `${ORBIT}, ${CORNERS}`;
import { chromium } from '@playwright/test';
import { pages, serve } from './serve.ts';

const NAME = 'stillness';
const IDLE_MS = 10_000;
// ponytail: frames are taken one at a time, so the gap between two frames of a page is FRAME_MS plus every shot of the batch
// (about 15 s on a quiet Mac, more under load): a pixel-only loop whose period divides that gap is missed. Two later frames
// per page narrow that; the DOM observer and animation counters cover CSS and JS loops.
const FRAME_MS = 1_300;
const PER_BATCH = 24;
const INSTANT_ARC_SECONDS = 0.001;
const MODES = { default: 'no-preference', reduce: 'reduce' } as const;

type Counted = { stillness: number; scrolled: number; strays: number };
type Running = { name: string; orbit: boolean; corner: boolean };
const findings: string[] = [];
let [changes, animations] = [0, 0];
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
    // ponytail: at most PER_BATCH pages per mode open at once (91 pages x 2 modes of full-page frames timed out); each batch gets the whole 10 s window.
    for (let at = 0; at < urls.length; at += PER_BATCH) {
      const batch = urls.slice(at, at + PER_BATCH);
      const open = Object.entries(MODES).map(async ([mode, reducedMotion]) => {
        const context = await browser.newContext({ reducedMotion });
        return Promise.all(
          batch.map(async (url) => {
            const page = await context.newPage();
            await page.goto(origin + url, { waitUntil: 'networkidle' });
            // page.evaluate is not subject to the page's CSP (see checks/axe.ts).
            // A drift on anything but the two corner arcs counts, even one that finishes before the final tally. Under reduce the
            // arcs are no exception: only the site's own instant drift is allowed, and every CSS animation list entry must be read.
            await page.evaluate(([allowed, exempt, instantArcSeconds]) => {
              const w = window as unknown as Counted;
              const list = (value: string) => value.split(',').map((entry) => entry.trim());
              const seconds = (value: string) => {
                const number = Number.parseFloat(value);
                return Number.isFinite(number) ? number / (value.endsWith('ms') ? 1000 : 1) : Infinity;
              };
              const instant = (name: string, el: Element) => {
                const style = getComputedStyle(el);
                const [names, durations, delays] = [style.animationName, style.animationDuration, style.animationDelay].map(list);
                const matching = names.map((current, index) => [current, index] as const).filter(([current]) => current === name);
                return matching.length > 0 && matching.every(([, index]) =>
                  seconds(durations[index % durations.length] ?? '') + seconds(delays[index % delays.length] ?? '') <= instantArcSeconds,
                );
              };
              const stray = (name: string, el: Element | null | undefined) =>
                name === 'drift' && !(el?.matches(allowed) && (exempt || instant(name, el)));
              w.stillness = 0;
              w.scrolled = 0;
              w.strays = document.getAnimations().filter((a) => stray((a as CSSAnimation).animationName, (a.effect as KeyframeEffect | null)?.target)).length;
              addEventListener('animationstart', (e) => stray(e.animationName, e.target as Element) && w.strays++, true);
              addEventListener('scroll', () => w.scrolled++, { capture: true, passive: true });
              new MutationObserver((records) => (w.stillness += records.length)).observe(document, {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true,
              });
            }, [CORNERS, mode === 'default', INSTANT_ARC_SECONDS] as const);
            if (mode === 'default')
              await page.evaluate((hidden) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(`${hidden} { visibility: hidden; }`);
                document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
              }, HIDDEN);
            return { url, mode, page };
          }),
        );
      });
      const watched = (await Promise.all(open)).flat();
      // The whole page, so motion below the fold counts. caret 'initial': Playwright's default hides the caret by writing a
      // style on every input, a DOM change. ponytail: a full-page frame fires resize (Chromium lays the page out at full
      // height for it), so a page that changes its DOM on resize is reported; make that page stop, not this check.
      // One frame at a time: a frame's cost grows with the frames in flight (48 at once took 170 s each at Mac load 40, one at a
      // time 4 s), so a whole batch at once broke Playwright's 30 s limit. ponytail: a quiet Mac pays a few seconds more per batch.
      const frames = async () => {
        const out: Buffer[] = [];
        for (const { page } of watched) out.push(await page.screenshot({ caret: 'initial', fullPage: true }));
        return out;
      };
      // One settle beat (a FRAME_MS) after load and instrumentation, so `first` is not the very first paint. The observer, the scroll and
      // animation counters still run from load. This only narrows what the pixel window can miss: it never covered the first moment
      // after load, before batching either (182 pages loading at once took their first frame seconds late), and a thing that paints for
      // that moment alone is not seen here. The home page's first-frame arc over the video poster is tracked as its own defect.
      await new Promise((done) => setTimeout(done, FRAME_MS));
      const first = await frames();
      const moved = new Set<number>();
      // At least two later frames, so a slow batch (one pass longer than IDLE_MS) still gives each page two comparisons.
      for (let taken = 0, start = Date.now(); taken < 2 || Date.now() - start < IDLE_MS; taken++) {
        await new Promise((done) => setTimeout(done, FRAME_MS));
        for (const [i, frame] of (await frames()).entries()) if (!frame.equals(first[i])) moved.add(i);
      }
      for (const [i, { url, mode, page }] of watched.entries()) {
        const [changed, scrolled, strays, arcs, all] = await page.evaluate(([orbit, corners]) => [
          (window as unknown as Counted).stillness,
          (window as unknown as Counted).scrolled,
          (window as unknown as Counted).strays,
          document.querySelectorAll(corners).length,
          document.getAnimations().filter((a) => a.playState === 'running').map((a): Running => ({
            name: (a as CSSAnimation).animationName ?? '',
            orbit: (a.effect as KeyframeEffect | null)?.target?.matches(orbit) ?? false,
            corner: (a.effect as KeyframeEffect | null)?.target?.matches(corners) ?? false,
          })),
        ], [ORBIT, CORNERS]) as [number, number, number, number, Running[]];
        const orbits = mode === 'default' ? all.filter((a) => a.name === 'orbit' && a.orbit) : [];
        const corners = mode === 'default' ? all.filter((a) => a.name === 'drift' && a.corner) : [];
        const running = all.length - orbits.length - corners.length + strays;
        if (arcs > 2) findings.push(`${NAME}: ${url} [${mode}]: more than two home corner arcs`);
        if (arcs && url !== '/') findings.push(`${NAME}: ${url} [${mode}]: home corner arcs off the home page`);
        if (orbits.length > 1) findings.push(`${NAME}: ${url} [${mode}]: more than one Start orbit`);
        changes += changed;
        animations += running;
        if (changed) findings.push(`${NAME}: ${url} [${mode}]: DOM changed with no input`);
        if (running) findings.push(`${NAME}: ${url} [${mode}]: animation running with no input`);
        if (scrolled) findings.push(`${NAME}: ${url} [${mode}]: scrolled with no input`);
        if (moved.has(i)) findings.push(`${NAME}: ${url} [${mode}]: pixels changed with no input`);
      }
      await Promise.all(browser.contexts().map((c) => c.close()));
    }
  } finally {
    await browser.close();
    await close();
  }
}

if (ok) console.log(`DOM changes: ${changes}  running animations: ${animations}`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
