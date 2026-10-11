// The guard's own proof (plan T3.4, F8): a quiet page passes, and each bad page makes the guard fail its test, which
// test.fail() counts as a pass. Each bad page is served by page.route on the test origin, so none of them is in dist.
import { readFileSync } from 'node:fs';
import { test } from './guard.ts';

test('a quiet page passes the guard', async ({ page }) => {
  await page.goto('/');
});

const BAD = ['notify', 'alert', 'confirm', 'prompt', 'open', 'print', 'worker', 'play', 'third-party', 'websocket', 'cookie', 'console'];
for (const name of BAD) {
  test(`the guard fails a page that uses ${name}`, async ({ page }) => {
    test.fail();
    const body = readFileSync(`fixtures/bad/guard/${name}.html`, 'utf8');
    await page.route('/bad/', (route) => route.fulfill({ contentType: 'text/html', body }));
    await page.goto('/bad/');
  });
}

// pr3-review NICE 1: a spec's own catch-all route wins over the guard's, so the guard must still see the request. The
// other origin is this server under another name, so nothing leaves the device.
test('the guard fails a request to another origin that a catch-all page route lets through', async ({ page, baseURL }) => {
  test.fail();
  const other = (baseURL ?? '').replace('127.0.0.1', 'localhost');
  await page.route('**/*', (route) => (route.request().url().endsWith('/bad/') ? route.fulfill({ contentType: 'text/html', body: `<script>location.href = '${other}/help/'</script>` }) : route.continue()));
  await page.goto('/bad/');
  await page.waitForURL(`${other}/help/`);
});
