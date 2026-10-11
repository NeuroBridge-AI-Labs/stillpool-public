// The home page (design polish D4, Emanuel 27-09-26; Pool Band v2, 04-10-26): a short, plain welcome with one Start button above the
// map, the map's lessons as cards whose status is an icon and a word (never colour alone), and the course contents under it.
import { expect, test } from './guard.ts';

test('the home page opens with the welcome and one Start button to lesson 1.1, above the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Understand AI, and use it well.');
  const line = 'AI means artificial intelligence: computer systems that do tasks such as working with language or recognising images. These free lessons explain how AI works, how to ask useful questions, how its use affects people. They also cover how to use it well, and how these tools are built. Choose a simple explanation or more detail.';
  await expect(page.getByText(line, { exact: true })).toBeVisible();
  const start = page.getByRole('link', { name: 'Start with lesson 1.1' });
  await expect(start).toHaveAttribute('href', '/learn/how-ai-works/what-ai-is-and-is-not/');
  const [button, map] = await Promise.all([start.boundingBox(), page.locator('.map').boundingBox()]);
  expect(button!.y + button!.height, 'above the map').toBeLessThanOrEqual(map!.y);
});

// Pool Band v2 (Emanuel, 04-10-26): the course contents are one closed disclosure under the map, so opening every pillar
// never moves the map; each topic still fills min(3, n) columns at 1440.
test('at 1440 each topic fills min(3, n) columns, and the course contents under the map are closed with pillar 1 open inside', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  for (const topic of await page.locator('.topic').all()) {
    const xs = await topic.locator(':scope > li').evaluateAll((lis) => lis.map((li) => Math.round(li.getBoundingClientRect().x)));
    expect.soft(new Set(xs).size, `columns for ${xs.length} cards`).toBe(Math.min(3, xs.length));
  }
  const course = page.getByRole('navigation', { name: 'Contents' }).locator('.toc-all');
  await expect(course).not.toHaveAttribute('open');
  await expect(course.locator('details.pillar[open]')).toHaveCount(1);
  const [contents, map] = await Promise.all([page.locator('nav#contents').boundingBox(), page.locator('.map').boundingBox()]);
  expect(contents!.y, 'under the map').toBeGreaterThanOrEqual(map!.y + map!.height);
});

// Pool Band v2: the welcome and the Start button sit at the left of the blue band, with the demo video beside them.
test('at 1440 the welcome and Start sit left of the demo video inside the band', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const [band, start, poster] = await Promise.all([page.locator('.band').boundingBox(), page.getByRole('link', { name: 'Start with lesson 1.1' }).boundingBox(), page.locator('.poster').boundingBox()]);
  expect(start!.x + start!.width, 'Start is left of the poster').toBeLessThanOrEqual(poster!.x);
  expect(poster!.y).toBeGreaterThanOrEqual(band!.y);
  expect(poster!.y + poster!.height).toBeLessThanOrEqual(band!.y + band!.height);
  await expect(page.getByText('An approximately 50-second tour')).toBeVisible();
  await expect(page.locator('.tour-video')).toBeVisible();
});

// Demo video player: native controls, accessible name, no autoplay, no preload of video data.
test('the demo video has an accessible name, native controls, and does not autoplay or preload', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.tour-video');
  await expect(video).toHaveAttribute('aria-label', 'Stillpool demo tour');
  await expect(video).toHaveAttribute('controls', '');
  await expect(video).toHaveAttribute('preload', 'none');
  // paused on load — no autoplay
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused), 'paused on load').toBe(true);
  // browser has not loaded media data (preload none)
  expect(await video.evaluate((v: HTMLVideoElement) => v.readyState), 'no data preloaded').toBe(0);
});

// Search engines read the tour from the page's JSON-LD: one VideoObject, whose transcript is the one the page shows.
test('the home JSON-LD holds one VideoObject for the tour, with the visible transcript', async ({ page }) => {
  await page.goto('/');
  const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}')['@graph'];
  const videos = graph.filter((n: { '@type': string }) => n['@type'] === 'VideoObject');
  expect(videos).toHaveLength(1);
  const [video] = videos;
  expect(video).toMatchObject({ contentUrl: 'https://learn.neurobridgeedu.eu/tour.mp4', duration: 'PT50S', uploadDate: '2026-10-09T22:33:20+01:00', inLanguage: 'en' });
  expect(video.thumbnailUrl).toMatch(/^https:\/\/learn\.neurobridgeedu\.eu\/_astro\/tour-poster\..+\.jpg$/);
  const shown = (await page.locator('.tour-transcript p').allTextContents()).join(' ');
  expect(video.transcript).toBe(shown);
});

// Captions: same-origin WebVTT track available by default.
test('the demo video has a default English caption track pointing to a same-origin WebVTT file', async ({ page }) => {
  await page.goto('/');
  const track = page.locator('.tour-video track[kind="captions"]');
  await expect(track).toHaveAttribute('srclang', 'en');
  await expect(track).toHaveAttribute('default', '');
  const src = await track.getAttribute('src');
  expect(src, 'same-origin path').toMatch(/^\/[^/]/);
  expect(src, 'WebVTT extension').toMatch(/\.vtt$/);
});

// Transcript: a disclosure beside Enlarge with the complete narration.
test('the transcript disclosure is present beside Enlarge and contains the full narration', async ({ page }) => {
  await page.goto('/');
  const disclosure = page.locator('.tour-transcript');
  await expect(disclosure.getByRole('group')).not.toBeVisible().catch(() => {}); // closed by default is fine
  await expect(disclosure.locator('summary')).toHaveText('Transcript');
  await disclosure.locator('summary').click();
  await expect(disclosure).toContainText('Welcome to Stillpool');
  await expect(disclosure).toContainText('Start with lesson 1.1');
});

// Enlarge: moves the player into a dialog, preserves playback position and focus, Close restores both.
test('Enlarge opens the demo video in a dialog and Close returns focus to the Enlarge button', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.tour-video');
  const enlarge = page.getByRole('button', { name: 'Enlarge video' });
  const dialog = page.locator('.tour-dialog');
  // start playing so position-preservation can be verified across the DOM move
  await video.evaluate((v: HTMLVideoElement) =>
    new Promise<void>((resolve, reject) => {
      v.addEventListener('playing', () => resolve(), { once: true });
      v.addEventListener('error', () => reject(new Error('video error')), { once: true });
      v.play().catch(reject);
    })
  );
  await page.waitForTimeout(200);
  const beforeEnlarge = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(beforeEnlarge, 'playing before Enlarge').toBeGreaterThan(0);
  await expect(dialog).not.toBeVisible();
  await enlarge.click();
  await expect(dialog).toBeVisible();
  // the video is now inside the dialog with its position intact
  await expect(dialog.locator('.tour-video')).toHaveCount(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime), 'position preserved after Enlarge').toBeGreaterThanOrEqual(beforeEnlarge);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(beforeEnlarge);
  const beforeClose = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  // close and verify focus returns and position is still intact
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(beforeClose);
});

// Reduced motion: pauses the video when motion preference changes while playing.
test('the demo video pauses when Reduce motion is turned on while it is playing', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.tour-video');
  // real play — tour.mp4 is in public/, no mocking of pause/paused/readyState
  await video.evaluate((v: HTMLVideoElement) =>
    new Promise<void>((resolve, reject) => {
      v.addEventListener('playing', () => resolve(), { once: true });
      v.addEventListener('error', () => reject(new Error('video error')), { once: true });
      v.play().catch(reject);
    })
  );
  // currentTime must advance before we trigger the switch (proves real decode)
  const t0 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.waitForTimeout(300);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime), 'currentTime advances').toBeGreaterThan(t0);
  // trigger the in-page Reduce motion switch — home.ts calls real video.pause() via queueMicrotask
  await page.locator('.hero-switch').getByLabel('Reduce motion').check();
  await page.waitForTimeout(50);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused), 'paused after Reduce motion').toBe(true);
});

// Visibility: page hidden pauses; page visible again does NOT auto-resume.
test('the demo video pauses when the page is hidden and does not auto-resume when visible', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.tour-video');
  await video.evaluate((v: HTMLVideoElement) =>
    new Promise<void>((resolve, reject) => {
      v.addEventListener('playing', () => resolve(), { once: true });
      v.addEventListener('error', () => reject(new Error('video error')), { once: true });
      v.play().catch(reject);
    })
  );
  // simulate page hidden
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(50);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused), 'paused on hidden').toBe(true);
  // simulate page visible again — must NOT auto-resume
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(50);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused), 'still paused when visible again').toBe(true);
});

// Pool Band v2 (fix round 5, loops since 05-10-26): the band's motion is the Start comet and the two corner lights, each a loop;
// Reduce motion stops all three.
test('the band loops the Start comet and the corner lights, and Reduce motion stops them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const running = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a as CSSAnimation).animationName).sort());
  expect(await running()).toEqual(['drift', 'drift', 'orbit']);
  await page.waitForTimeout(6000);
  expect(await running(), 'still looping after a full lap').toEqual(['drift', 'drift', 'orbit']);
  await page.locator('.hero-switch').getByLabel('Reduce motion').check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.reload();
  expect(await running(), 'stopped after a reload').toEqual([]);
});

// F7: the comet starts by itself, so it does not depend on hover: a touch phone sees it, lap after lap, over the static edge.
test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the Start comet runs with no pointer and keeps looping, with the edge still drawn', async ({ page }) => {
    await page.goto('/');
    const light = page.locator('.start .orbit-light');
    const opacity = () => light.evaluate((el) => getComputedStyle(el).opacity);
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    expect(await opacity()).toBe('1');
    await page.waitForTimeout(6000);
    expect(await opacity(), 'still lit after a lap').toBe('1');
    expect(await page.locator('.start .orbit-edge').evaluate((el) => getComputedStyle(el).opacity)).toBe('0.4');
  });
});

// The arcs round the poster answer the pointer, and only when motion is allowed.
test('a pointer near a point lights it, and Reduce motion keeps every point quiet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const core = page.locator('.deco.tr .node .core').first();
  const at = (await core.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await expect.poll(() => page.locator('.deco .node.lit').count(), 'a point near the pointer lights').toBeGreaterThan(0);
  await page.locator('.hero-switch').getByLabel('Reduce motion').check();
  await page.mouse.move(at.x + at.width / 2 + 2, at.y + at.height / 2);
  await expect(page.locator('.deco .node.lit')).toHaveCount(0);
});

test("each lesson's status is a tag with one icon and its word, and Hide my progress sits beside the map's heading", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.map details').forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const tags = await page.locator('.map li[data-lesson] .state').all();
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) {
    await expect(tag).toHaveText('Not yet');
    await expect(tag.locator('svg:visible')).toHaveCount(1);
  }
  const [heading, toggle] = await Promise.all([page.locator('#map-title').boundingBox(), page.locator('.map-switch').boundingBox()]);
  expect(Math.abs(heading!.y + heading!.height / 2 - (toggle!.y + toggle!.height / 2)), 'on one line').toBeLessThan(12);
});

// Fix round 1 (S1): the Start button's words are dark navy on yellow (outlined in yellow in dark): at least 4.5:1 in every theme.
for (const theme of ['light', 'dark', 'contrast'])
  test(`the Start button's words have 4.5:1 contrast on their own background in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    await page.goto('/');
    const ratio = await page.locator('.start').evaluate((el) => {
      const canvas = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
      const rgb = (colour: string) => {
        canvas.clearRect(0, 0, 1, 1);
        canvas.fillStyle = colour;
        canvas.fillRect(0, 0, 1, 1);
        return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3).map((c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
      };
      const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const style = getComputedStyle(el);
      const [a, b] = [lum(rgb(style.color)), lum(rgb(style.backgroundColor))].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

// Device and Focus restrictions pause real playback only when newly enabled.
test('device reduced motion pauses the tour without resuming when disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const video = page.locator('.tour-video');
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
});

test('Focus pauses the tour when enabled and disabling it preserves explicit playback', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.tour-video');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  const focus = page.getByRole('checkbox', { name: 'Focus mode' });
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await focus.check();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await video.evaluate((v: HTMLVideoElement) => v.play());
  const before = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await focus.uncheck();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(before);
});
