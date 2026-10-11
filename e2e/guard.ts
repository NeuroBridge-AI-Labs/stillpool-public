// Every e2e test runs under this guard (plan D14, S2), so every interaction path is also a privacy and calm check. An
// auto fixture aborts and records any request to another origin (workers included, F7) and any WebSocket, records
// each call a page makes to an interruption API, and collects console and page errors (a CSP violation is a console
// error). At teardown all of them, and the context's cookies, must be empty. Specs import test and expect from here.
import { expect, test as base } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';

// allowApiRefusal: the test stubs a 4xx or 5xx from the lab's or the feedback function on purpose, so the browser's console line for it
// is expected. Off by default: an unstubbed failure at /api/lab/ then fails the test like any other console error.
export const test = base.extend<{ guard: void; allowApiRefusal: boolean }>({
  allowApiRefusal: [false, { option: true }],
  guard: [
    async ({ context, baseURL, allowApiRefusal }, use) => {
      const [offsite, calls, errors] = [[], [], []] as string[][];
      // Recorded by a listener, so a spec's own catch-all page.route, which wins over this one, cannot hide a request.
      const offOrigin = (url: string) => new URL(url).origin !== new URL(baseURL ?? '').origin;
      context.on('request', (r) => offOrigin(r.url()) && offsite.push(r.url()));
      await context.route('**/*', (route) => (offOrigin(route.request().url()) ? route.abort() : route.continue()));
      // route() never sees a WebSocket, and the site opens none: every one is recorded and closed unsent.
      await context.routeWebSocket(/./, (ws) => (offsite.push(ws.url()), ws.close()));
      // A binding, not a record in the page, so a call on one page survives a navigation to the next.
      await context.exposeBinding('guardCall', (_, name: string) => calls.push(name));
      await context.addInitScript(() => {
        const called = (name: string) => (window as unknown as { guardCall: (n: string) => void }).guardCall(name);
        for (const name of ['alert', 'confirm', 'prompt', 'open', 'print'] as const)
          (window as unknown as Record<string, () => null>)[name] = () => (called(name), null);
        window.Notification = class {
          constructor() {
            called('Notification');
          }
          static requestPermission = () => (called('Notification.requestPermission'), Promise.resolve('denied'));
        } as unknown as typeof Notification;
        if (navigator.serviceWorker)
          navigator.serviceWorker.register = () => (called('serviceWorker.register'), new Promise<never>(() => {}));
        // Sound only after the learner acts: Emma's Read aloud plays inside a click, anything else is a call.
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          return navigator.userActivation.isActive ? play.call(this) : (called('play'), Promise.resolve());
        };
      });
      // An aborted request also logs ERR_FAILED at its own URL, which offsite already holds.
      // The browser logs a 4xx or 5xx fetch as a console error. Only a test that set allowApiRefusal lets the failed
      // load of the lab's own function through.
      const stubbedRefusal = (m: { text(): string; location(): { url: string } }) =>
        allowApiRefusal && m.text().startsWith('Failed to load resource') && ['/api/lab/', '/api/feedback/'].includes(new URL(m.location().url).pathname);
      context.on('console', (m) => m.type() === 'error' && !offsite.includes(m.location().url) && !stubbedRefusal(m) && errors.push(m.text()));
      context.on('weberror', (e) => errors.push(String(e.error())));
      await use();
      for (const page of context.pages()) await page.evaluate(() => 0).catch(() => {}); // lets a last call arrive
      const cookies = (await context.cookies()).map((c) => c.name);
      expect({ offsite, calls, errors, cookies }, 'the guard').toEqual({ offsite: [], calls: [], errors: [], cookies: [] });
    },
    { auto: true },
  ],
});
