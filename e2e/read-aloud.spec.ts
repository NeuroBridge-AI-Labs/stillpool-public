// Read-aloud (plan T9.4, D13): on-device voices only, always named. speechSynthesis is stubbed with a network voice
// listed first, so a missing localService filter would pick it.
import { readFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { pages } from '../checks/serve.ts';
import { readVoiceParts } from '../checks/voice-parts.ts';
import { expect, type Page, test } from './guard.ts';

const lesson = pages('dist').find((route) => route.startsWith('/learn/')) as string;
const NETWORK = { name: 'Cloud Voice', lang: 'en-US', localService: false, voiceURI: 'cloud', default: true };
const FRENCH = { name: 'Voix locale', lang: 'fr-FR', localService: true, voiceURI: 'fr-local', default: false };
const LOCAL = { name: 'Device Voice', lang: 'en-GB', localService: true, voiceURI: 'en-local', default: false };
const EMMA = 'Emma (en-GB), made for this site';

const REST = 'Emma could not play the rest of this part.';
const REST_BUTTON = "Read the rest with this device's voice";
const stub = (page: Page, voices: object[]) =>
  page.addInitScript((list) => {
    const spoken: { text: string; voice?: string }[] = [];
    let found = list;
    const listeners: (() => void)[] = [];
    const utterances: SpeechSynthesisUtterance[] = [];
    Object.assign(window, { spoken, utterances, setVoices: (next: object[]) => { found = next; listeners.forEach((listener) => listener()); } });
    window.SpeechSynthesisUtterance = class {
      text: string;
      voice: { name: string } | null = null;
      constructor(text: string) {
        this.text = text;
      }
    } as unknown as typeof SpeechSynthesisUtterance;
    const synth = {
      getVoices: () => found,
      speak: (u: SpeechSynthesisUtterance) => (utterances.push(u), spoken.push({ text: u.text, voice: u.voice?.name })),
      cancel: () => {},
      addEventListener: (_name: string, listener: () => void) => listeners.push(listener),
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
  }, voices);
// Every lesson has Emma's files now, so a device-voice test takes them away: a part with no file is read by the device voice on a click.
const noEmma = (page: Page) =>
  page.addInitScript(() => addEventListener('DOMContentLoaded', () => document.querySelectorAll('audio').forEach((a) => { delete a.dataset.simple; delete a.dataset.deep; })));
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spoken: object[] }).spoken);
const setVoices = (page: Page, voices: object[]) =>
  page.evaluate((next) => (window as unknown as { setVoices: (list: object[]) => void }).setVoices(next), voices);
const firstSection = (page: Page) => page.getByRole('group', { name: /^Listen to / }).first();
// The visible layers of the first Core section, as the reader sees them: Simple, then Deep when it shows too.
const visibleLayer = (page: Page) =>
  page.locator('[data-part="core"] h2').first().evaluate((h) => {
    const shown: HTMLElement[] = [];
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling)
      if (el instanceof HTMLElement && el.dataset.layer && el.checkVisibility()) shown.push(el);
    return { layers: shown.map((el) => el.dataset.layer), text: shown.map((el) => el.innerText).join('\n') };
  });

test('Read aloud speaks with the local voice only', async ({ page }) => {
  await stub(page, [NETWORK, LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => spoken(page)).toEqual([{ text: (await visibleLayer(page))?.text, voice: 'Device Voice' }]);
});

test("it passes the visible layers' text, Simple then Deep when Deep shows", async ({ page }) => {
  await stub(page, [NETWORK, LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await page.getByRole('group', { name: 'Reading depth for every section' }).getByRole('button', { name: 'Add Deep' }).click();
  const shown = await visibleLayer(page);
  expect(shown.layers).toEqual(['simple', 'deep']);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => spoken(page)).toEqual([{ text: shown.text, voice: 'Device Voice' }]);
});

test('with only a network voice, the control says it is unavailable and speak is never called', async ({ page }) => {
  await stub(page, [NETWORK]);
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ voice: 'cloud' }))); // the device voice is chosen, so Emma is not
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(firstSection(page).getByRole('status')).toHaveText('This device has no voice of its own, so it cannot read aloud here.');
  expect(await spoken(page)).toEqual([]);
});

test('the Reading voice list offers local voices only, English first', async ({ page }) => {
  await stub(page, [NETWORK, FRENCH, LOCAL]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  const list = page.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Reading voice' });
  await expect(list.locator('option')).toHaveText([EMMA, 'Device Voice (en-GB)', 'Voix locale (fr-FR)']);
});

test('late voices leave closed Settings still and fill the list when opened', async ({ page }) => {
  await stub(page, []);
  await page.goto('/');
  const list = page.locator('#voice');
  await list.evaluate((select) => {
    let count = 0;
    new MutationObserver((records) => { count += records.length; }).observe(select, { childList: true, attributes: true, subtree: true });
    Object.assign(window, { voiceMutations: () => count });
  });
  const mutations = () => page.evaluate(() => (window as unknown as { voiceMutations: () => number }).voiceMutations());
  await setVoices(page, [NETWORK, LOCAL]);
  expect(await mutations()).toBe(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  await expect(list.locator('option')).toHaveText([EMMA, 'Device Voice (en-GB)']);
  const before = await mutations();
  await setVoices(page, [NETWORK, LOCAL]);
  expect(await mutations()).toBe(before);
  await setVoices(page, [NETWORK]);
  await expect(list.locator('option')).toHaveText([EMMA]);
});

test('a voice choice that cannot be saved shows the voice that read-aloud uses', async ({ page }) => {
  await stub(page, [LOCAL, FRENCH]);
  await noEmma(page);
  await page.goto(lesson);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  const list = page.locator('#voice');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage blocked'); }; });
  await list.selectOption('fr-local');
  await expect(list).toHaveValue('emma');
  await page.getByRole('button', { name: 'Done' }).click();
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => spoken(page)).toEqual([{ text: (await visibleLayer(page))?.text, voice: 'Device Voice' }]);
});

// Emma (decision 13, amended 28-09-26): lesson 1.1's audio files, from public/voice/manifest.json. The shortest plays to its end.
const made = Object.entries(JSON.parse(readFileSync('public/voice/manifest.json', 'utf8')) as Record<string, { page: string; part: string; layer: string; seconds: number }>);
const [shortFile, short] = made.filter(([, e]) => e.layer === 'simple').sort(([, a], [, b]) => a.seconds - b.seconds)[0];
const emmaGroup = (page: Page) => page.locator(`.read[data-voice="${short.part}"]`);

test('Emma reads a part from its own file after Read aloud, loads nothing before, and ends without an error', async ({ page }) => {
  await stub(page, [LOCAL]);
  const loaded: string[] = [];
  page.on('request', (r) => r.url().endsWith('.mp3') && loaded.push(new URL(r.url()).pathname));
  await page.goto(short.page);
  const audio = emmaGroup(page).locator('audio');
  await expect(audio).toBeHidden();
  await expect(audio).toHaveAttribute('preload', 'none');
  expect(loaded).toEqual([]);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(audio).toBeVisible();
  await expect(emmaGroup(page).getByRole('status')).toHaveText('Emma is reading this part.');
  await expect(emmaGroup(page).getByRole('status')).toHaveText('Finished.', { timeout: (short.seconds + 10) * 1000 });
  const [error, duration] = await audio.evaluate((a: HTMLAudioElement) => [a.error, a.duration]);
  expect(error).toBeNull();
  expect(Math.abs((duration as number) - short.seconds)).toBeLessThan(0.2);
  expect(loaded[0]).toBe(`/${shortFile}`);
  expect(await spoken(page)).toEqual([]);
});

test('Stop pauses and hides Emma; a chosen device voice reads even where Emma has a file', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).getByRole('status')).toHaveText('Emma is reading this part.');
  await emmaGroup(page).getByRole('button', { name: 'Stop' }).click();
  await expect(emmaGroup(page).locator('audio')).toBeHidden();
  expect(await emmaGroup(page).locator('audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true))); // the disclosures start closed
  await page.locator('#voice').selectOption('en-local');
  await page.getByRole('button', { name: 'Done' }).click();
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).locator('audio')).toBeHidden();
  expect(await spoken(page)).toEqual([{ text: expect.any(String), voice: 'Device Voice' }]);
});

test('a file that cannot play offers the device voice, and speaks only after a click', async ({ page }) => {
  await stub(page, [LOCAL]);
  let tried = false;
  await page.route('**/*.mp3', (route) => ((tried = true), route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' })));
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).getByRole('status')).toHaveText(REST);
  expect(tried).toBe(true);
  await expect(emmaGroup(page).locator('audio')).toBeHidden();
  expect(await spoken(page)).toEqual([]);
  await emmaGroup(page).getByRole('button', { name: REST_BUTTON }).click();
  expect(await spoken(page)).toEqual([{ text: expect.any(String), voice: 'Device Voice' }]);
});

test('a rejected Emma play offers the device voice', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.goto(short.page);
  await emmaGroup(page).locator('audio').evaluate((audio: HTMLAudioElement) => {
    audio.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  });
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).getByRole('status')).toHaveText(REST);
  expect(await spoken(page)).toEqual([]);
  await expect(emmaGroup(page).locator('audio')).toBeHidden();
});

test('the offer keeps its line and button after the failed file fires media events', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route('**/*.mp3', (route) => route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }));
  await page.goto(short.page);
  const status = emmaGroup(page).getByRole('status');
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(status).toHaveText(REST);
  // The failed file may still fire play, pause, emptied or ended: for 2 s the line must not change.
  await emmaGroup(page).locator('audio').evaluate((a: HTMLAudioElement) => ['play', 'pause', 'emptied', 'ended'].forEach((t) => a.dispatchEvent(new Event(t))));
  await page.waitForTimeout(2000);
  await expect(status).toHaveText(REST);
  await expect(emmaGroup(page).getByRole('button', { name: REST_BUTTON })).toBeVisible();
  expect(await spoken(page)).toEqual([]);
});

const corruptShort = (page: Page) =>
  page.route('**/*.mp3', (route) => (route.request().url().endsWith(`/${shortFile}`) ? route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }) : route.continue()));

test('Stop clears the offer, its line and its button', async ({ page }) => {
  await stub(page, [LOCAL]);
  await corruptShort(page);
  await page.goto(short.page);
  const status = emmaGroup(page).getByRole('status');
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(status).toHaveText(REST);
  await emmaGroup(page).getByRole('button', { name: 'Stop' }).click();
  await expect(status).toHaveText('');
  await expect(emmaGroup(page).getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
});

test('another part taking over clears the first part\'s offer, line and button', async ({ page }) => {
  await stub(page, [LOCAL]);
  await corruptShort(page);
  await page.goto(short.page);
  const status = emmaGroup(page).getByRole('status');
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(status).toHaveText(REST);
  const other = page.locator(`.read:not([data-voice="${short.part}"])`).first();
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await expect(other.getByRole('status')).toHaveText('Emma is reading this part.');
  await expect(status).toHaveText('');
  await expect(emmaGroup(page).getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
});

// Deep adds under Simple (spec 3.4): with both layers showing, Emma plays the Simple file, then the Deep file.
const pair = made
  .filter(([, e]) => e.layer === 'deep')
  .map(([, deep]) => ({ deep, simple: made.find(([, e]) => e.page === deep.page && e.part === deep.part && e.layer === 'simple') }))
  .filter((p) => p.simple)[0];
const both = pair.deep;
const bothSeconds = made.find(([, e]) => e.page === both.page && e.part === both.part && e.layer === 'deep')?.[1].seconds ?? 60;
const bothFile = (layer: string) => made.find(([, e]) => e.page === both.page && e.part === both.part && e.layer === layer)?.[0];

test('with Deep shown, Emma plays the Simple file then the Deep file, in that order', async ({ page }) => {
  await stub(page, [LOCAL]);
  const loaded: string[] = [];
  page.on('request', (r) => r.url().endsWith('.mp3') && loaded.push(new URL(r.url()).pathname));
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText('Emma is reading this part.');
  const skipToEnd = () => group.locator('audio:not([hidden])').evaluate((a: HTMLAudioElement) => { a.currentTime = a.duration - 0.2; });
  for (const layer of ['simple', 'deep']) {
    await expect.poll(() => group.locator('audio:not([hidden])').evaluate((a: HTMLAudioElement) => new URL(a.src).pathname)).toBe(`/${bothFile(layer)}`);
    await expect.poll(() => group.locator('audio:not([hidden])').evaluate((a: HTMLAudioElement) => a.readyState >= 1 && !a.paused)).toBe(true);
    await skipToEnd();
  }
  expect(new Set(loaded)).toEqual(new Set([`/${bothFile('simple')}`, `/${bothFile('deep')}`])); // both load at the start, Deep while Simple plays
  await expect(group.getByRole('status')).toHaveText('Finished.');
  expect(await spoken(page)).toEqual([]);
});

test('with Deep shown and one layer without a file, the device voice reads both layers', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await group.locator('audio').evaluate((a: HTMLAudioElement) => delete a.dataset.deep);
  const text = await group.evaluate((g) => {
    const shown: string[] = [];
    for (let el = g.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling)
      if (el instanceof HTMLElement && el.dataset.layer && el.checkVisibility()) shown.push(`${el.dataset.layer}:${el.innerText}`);
    return shown;
  });
  expect(text.map((t) => t.split(':')[0])).toEqual(['simple', 'deep']);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => spoken(page)).toEqual([{ text: text.map((t) => t.slice(t.indexOf(':') + 1)).join('\n'), voice: 'Device Voice' }]);
  await expect(group.locator('audio')).toBeHidden();
});

// Deep adds, review findings D1 to D4 (04-10-26).
const FALLBACK_LINE = REST; // no longer a line that says the device voice is reading: nothing may start it by itself
const READING = 'Emma is reading this part.';
const deepUrl = new RegExp(`/${bothFile('deep')}$`);
// The element reports a NaN duration until its metadata has loaded, and currentTime = NaN throws: wait for a real one first.
const seekToEnd = async (page: Page, group: ReturnType<Page['locator']>) => {
  const audio = group.locator('audio:not([hidden])');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => Number.isFinite(a.duration) && a.duration > 0)).toBe(true);
  await audio.evaluate((a: HTMLAudioElement) => { a.currentTime = a.duration - 0.2; });
};
// Every distinct status line the group's status shows, in order.
const watchStatus = (group: ReturnType<Page['locator']>) =>
  group.getByRole('status').evaluate((el) => {
    const seen: string[] = [];
    Object.assign(window, { seen });
    new MutationObserver(() => { const t = el.textContent ?? ''; if (seen.at(-1) !== t) seen.push(t); }).observe(el, { childList: true, characterData: true, subtree: true });
  });
const statuses = (page: Page) => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
const layerText = (group: ReturnType<Page['locator']>, layer: string) =>
  group.evaluate((g, l) => {
    const shown: string[] = [];
    for (let el = g.nextElementSibling; el && el.tagName !== 'H2' && !el.matches('[data-part]'); el = el.nextElementSibling) // the player's walk (visible() in src/readaloud.ts)
      if (el instanceof HTMLElement && el.dataset.layer === l && el.checkVisibility()) shown.push(el.innerText);
    return shown.join('\n');
  }, layer);

// No real part shows two Deep elements by the player's walk now, so the page gets a second one (a copy of the first) before the click.
for (const voices of [[LOCAL], []]) {
  test(`a part with two Deep elements plays Emma's two files (${voices.length ? 'with' : 'without'} a device voice)`, async ({ page }) => {
    await stub(page, voices);
    const loaded: string[] = [];
    page.on('request', (r) => r.url().endsWith('.mp3') && loaded.push(new URL(r.url()).pathname));
    await page.goto(`${both.page}?depth=deep`);
    const mine = page.locator(`.read[data-voice="${both.part}"]`);
    await mine.evaluate((g) => {
      for (let el = g.nextElementSibling; el; el = el.nextElementSibling)
        if (el instanceof HTMLElement && el.dataset.layer === 'deep') return el.after(el.cloneNode(true));
    });
    expect(await mine.evaluate((g) => {
      const layers: string[] = [];
      for (let el = g.nextElementSibling; el && el.tagName !== 'H2' && !el.matches('[data-part]'); el = el.nextElementSibling)
        if (el instanceof HTMLElement && el.dataset.layer && el.checkVisibility()) layers.push(el.dataset.layer);
      return layers.join();
    })).toBe('simple,deep,deep');
    await mine.getByRole('button', { name: 'Read aloud' }).click();
    await expect(mine.getByRole('status')).toHaveText(READING);
    await expect.poll(() => loaded.length).toBe(2);
    await seekToEnd(page, mine);
    await expect.poll(() => mine.locator('audio:not([hidden])').evaluate((a: HTMLAudioElement) => a.src.includes('-deep-') && !a.paused)).toBe(true);
    expect(await spoken(page)).toEqual([]);
  });
}

test('a failed Deep file after Simple played reads only the Deep text on the device voice', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, (route) => route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }));
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  const deepText = await layerText(group, 'deep');
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.waitForTimeout(500);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText(REST);
  expect(await spoken(page), 'nothing speaks by itself').toEqual([]);
  await group.getByRole('button', { name: REST_BUTTON }).click();
  expect(await spoken(page)).toEqual([{ text: deepText, voice: 'Device Voice' }]); // only the Deep text: Simple is not read twice
});

test('a failed Deep file with no device voice says so and offers no button', async ({ page }) => {
  await stub(page, []);
  await page.route(deepUrl, (route) => route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }));
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.waitForTimeout(500);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Emma could not play the rest of this part, and this device has no voice of its own.');
  await expect(group.getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
});

test('a delayed Deep file is loaded while Simple plays, so the handoff has no gap', async ({ page }) => {
  await stub(page, [LOCAL]);
  let first = true;
  await page.route(deepUrl, async (route) => {
    if (first) { first = false; await new Promise((r) => setTimeout(r, 1500)); }
    await route.continue();
  });
  await page.addInitScript(() => {
    const t: Record<string, number> = {};
    Object.assign(window, { t });
    addEventListener('ended', () => (t.ended ??= performance.now()), true);
    addEventListener('playing', () => { if (t.ended) t.playing ??= performance.now(); }, true);
  });
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.waitForTimeout(2000); // longer than the delay: a prepared Deep file is loaded by now
  await seekToEnd(page, group);
  await expect.poll(() => page.evaluate(() => (window as unknown as { t: Record<string, number> }).t.playing)).toBeGreaterThan(0);
  const t = await page.evaluate(() => (window as unknown as { t: Record<string, number> }).t);
  console.log(`handoff Simple ended to Deep playing: ${Math.round(t.playing - t.ended)} ms`);
  expect(t.playing - t.ended).toBeLessThan(300);
});

test('through a two-file read the status never says Finished before Deep has played', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.goto(`${both.page}?depth=deep`);
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await watchStatus(group);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.waitForTimeout(1500);
  await seekToEnd(page, group);
  await expect.poll(() => group.locator('audio:not([hidden])').evaluate((a: HTMLAudioElement) => a.src.includes('-deep-') && a.readyState >= 1 && !a.paused)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Finished.', { timeout: (bothSeconds + 10) * 1000 });
  // The guard switches the browser cache off, so Deep's own request may show Loading (D7); Finished still comes only after Deep.
  const seen = (await statuses(page)).filter((t) => t !== 'Loading the next layer.').filter((t, i, all) => t !== all[i - 1]); // in order, only adjacent repeats collapsed
  expect(seen, 'no Finished before Deep ends, and one final Finished').toEqual([READING, 'Finished.']);
});

// Deep adds, review round 2 (D3 status, D5 to D8): one player plays every layer.
const readAloud = async (page: Page) => {
  const group = page.locator(`.read[data-voice="${both.part}"]`);
  await page.goto(`${both.page}?depth=deep`);
  return group;
};
const player = (group: ReturnType<Page['locator']>) => group.locator('audio:not([hidden])');
const isDeepPlaying = (group: ReturnType<Page['locator']>) =>
  player(group).evaluate((a: HTMLAudioElement) => a.src.includes('-deep-') && !a.paused && a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA);

test("D5: the learner's mute and volume carry from Simple to Deep", async ({ page }) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await player(group).evaluate((a: HTMLAudioElement) => { a.muted = true; a.volume = 0.2; });
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group)).toBe(true);
  expect(await player(group).evaluate((a: HTMLAudioElement) => ({ muted: a.muted, volume: a.volume }))).toEqual({ muted: true, volume: 0.2 });
});

test('D6: Stop while Deep plays clears the reading line', async ({ page }) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group)).toBe(true);
  await group.getByRole('button', { name: 'Stop' }).click();
  await expect(group.getByRole('status')).toHaveText('');
  await expect(group.locator('audio')).toBeHidden();
  expect(await group.locator('audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
});

test('D7 and D3: a seek to the end of Simple before Deep has arrived shows Loading until Deep plays', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, async (route) => { // a slow network: every Deep request takes 1,500 ms
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const group = await readAloud(page);
  await watchStatus(group);
  await group.getByRole('status').evaluate((el) => { // each write to the status, with whether the media has data to play right then
    const writes: string[] = [];
    Object.assign(window, { writes });
    new MutationObserver(() => {
      const a = el.parentElement?.querySelector('audio');
      writes.push(`${el.textContent}|${a && a.src.includes('-deep-') && a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? 'deep-ready' : 'not-ready'}`);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await expect.poll(() => player(group).evaluate((a: HTMLAudioElement) => a.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true);
  const at = Date.now();
  await seekToEnd(page, group); // as soon as Simple has loaded
  await expect.poll(() => isDeepPlaying(group), { timeout: 10000 }).toBe(true);
  console.log(`rapid seek to Deep playing: about ${Date.now() - at} ms`);
  expect(await statuses(page)).toEqual([READING, 'Loading the next layer.', READING]);
  const writes = await page.evaluate(() => (window as unknown as { writes: string[] }).writes);
  expect(writes.at(-1), 'the reading line returns only once Deep has data').toBe(`${READING}|deep-ready`);
});

test('D8: Simple only on screen, then a failed Deep file, speaks nothing and finishes', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, (route) => route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }));
  const group = await readAloud(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.evaluate(() => delete document.documentElement.dataset.depth); // the page flips to Simple while Simple plays
  expect(await layerText(group, 'deep')).toBe('');
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Finished.');
  expect(await spoken(page)).toEqual([]);
});

test("the learner's playback speed carries from Simple to Deep", async ({ page }) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await player(group).evaluate((a: HTMLAudioElement) => { a.playbackRate = 0.75; });
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group)).toBe(true);
  expect(await player(group).evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(0.75);
});

// Deep adds, review round 3 (D3, D7, D9, D10).
test('D7: a ready warmer does not make the status say reading while the playing player waits for its own data', async ({ page }) => {
  await stub(page, [LOCAL]);
  let requests = 0;
  await page.route(deepUrl, async (route) => { // the warmer's request is quick, the player's own request after it takes 1,500 ms
    if (requests++) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const group = await readAloud(page);
  await watchStatus(group);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await page.waitForTimeout(1500); // the warmer is ready
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group), { timeout: 10000 }).toBe(true);
  expect(await statuses(page)).toEqual([READING, 'Loading the next layer.', READING]);
});

test('D9: the warmer is released once Deep plays, and on Stop', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.addInitScript(() => {
    const Real = window.Audio;
    const made: HTMLAudioElement[] = [];
    Object.assign(window, { made, Audio: function () { return made[made.push(new Real()) - 1]; } });
  });
  const group = await readAloud(page);
  const held = () => page.evaluate(() => (window as unknown as { made: HTMLAudioElement[] }).made.map((a) => a.hasAttribute('src')));
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  expect(await held(), 'while Simple plays the warmer holds Deep').toEqual([true]);
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group)).toBe(true);
  expect(await held(), 'Deep plays: the warmer is released').toEqual([false]);
  await group.getByRole('button', { name: 'Read aloud' }).click(); // a new run warms again, and Stop releases it
  await expect(group.getByRole('status')).toHaveText(READING);
  expect(await held()).toEqual([false, true]);
  await group.getByRole('button', { name: 'Stop' }).click();
  expect(await held()).toEqual([false, false]);
});

test('D10: Read aloud again while Deep is loading restarts Simple, with no device voice and no hidden playback', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, async (route) => { // Deep is still loading when the learner presses Read aloud again
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const group = await readAloud(page);
  await watchStatus(group);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await expect.poll(() => player(group).evaluate((a: HTMLAudioElement) => a.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Loading the next layer.');
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await page.waitForTimeout(2500); // long enough for the old play() to reject and for any wrong fallback to show
  await expect(group.getByRole('status')).toHaveText(READING);
  expect(await spoken(page)).toEqual([]);
  expect(await player(group).evaluate((a: HTMLAudioElement) => ({ simple: a.src.includes('-simple-'), paused: a.paused, hidden: a.hidden }))).toEqual({ simple: true, paused: false, hidden: false });
  expect(await statuses(page)).not.toContain(FALLBACK_LINE);
});

// D3: real HTTP. page.route() switches the browser's cache off, so a proxy in front of the site serves the files the way
// vercel.json says to, and waits 1,500 ms before every Deep response.
const upstream = Number(process.env.E2E_PORT || 4399);
const proxyPort = upstream + 2;
const voiceRule = (JSON.parse(readFileSync('vercel.json', 'utf8')).headers as { source: string; headers: { key: string; value: string }[] }[]).find((h) => h.source.startsWith('/voice/'));
test.describe('natural handoff over real HTTP', () => {
  test.use({ baseURL: `http://127.0.0.1:${proxyPort}` });
  let proxy: Server;
  const deepHits: string[] = [];
  test.beforeAll(async () => {
    proxy = createServer((req, res) => {
      const out = request({ host: '127.0.0.1', port: upstream, path: req.url, method: req.method, headers: req.headers }, async (up) => {
        const headers = { ...up.headers };
        if (voiceRule && new RegExp(`^${voiceRule.source}$`).test(req.url ?? '')) for (const h of voiceRule.headers) headers[h.key.toLowerCase()] = h.value;
        if (deepUrl.test(req.url ?? '')) {
          deepHits.push(`${req.method} ${req.headers.range ?? ''}`);
          await new Promise((r) => setTimeout(r, 1500));
        }
        res.writeHead(up.statusCode ?? 502, headers);
        up.pipe(res);
      });
      out.on('error', () => res.destroy());
      req.pipe(out);
    });
    await new Promise<void>((r) => proxy.listen(proxyPort, '127.0.0.1', r));
  });
  test.afterAll(() => new Promise((r) => proxy.close(r)));

  test('D3: at the natural end of Simple, Deep takes over with no second request and no gap', async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL }); // not the guarded context: its catch-all route switches the browser's cache off
    const page = await context.newPage();
    await stub(page, [LOCAL]);
    await page.addInitScript(() => {
      const t: Record<string, number> = {};
      Object.assign(window, { t });
      addEventListener('ended', () => (t.ended ??= performance.now()), true);
      addEventListener('playing', () => { if (t.ended) t.playing ??= performance.now(); }, true);
    });
    deepHits.length = 0;
    const group = await readAloud(page);
    await group.getByRole('button', { name: 'Read aloud' }).click();
    await expect(group.getByRole('status')).toHaveText(READING);
    const simpleSeconds = made.find(([, e]) => e.page === both.page && e.part === both.part && e.layer === 'simple')?.[1].seconds ?? 60;
    await expect.poll(() => page.evaluate(() => (window as unknown as { t: Record<string, number> }).t.playing), { timeout: (simpleSeconds + 30) * 1000 }).toBeGreaterThan(0);
    const t = await page.evaluate(() => (window as unknown as { t: Record<string, number> }).t);
    console.log(`natural handoff Simple ended to Deep playing: ${Math.round(t.playing - t.ended)} ms; Deep requests: ${deepHits.join(' | ')}`);
    expect(deepHits, 'one request, the warmer\'s').toHaveLength(1);
    expect(t.playing - t.ended).toBeLessThan(250);
    await context.close();
  });
});

test('vercel.json caches only the hashed files of Emma: every current MP3, and nothing else', () => {
  const rule = new RegExp(`^${voiceRule?.source}$`);
  expect(voiceRule?.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  for (const [file] of made) expect(rule.test(`/${file}`), file).toBe(true);
  for (const path of ['/voice/manifest.json', '/voice/learn/x/part.mp3', '/voice/learn/x/part-deep-zzzzzzzzzzzz.mp3', '/voice/learn/x/part-deep-2f0279c50e4.mp3', '/voice/learn/x/part-deep-2f0279c50e41.mp3.json', '/learn/part-deep-2f0279c50e41.mp3'])
    expect(rule.test(path), path).toBe(false);
});

// D13: a pending Deep play() of one part, cancelled by an action in ANOTHER part, must not start the device voice.
const otherPart = async (page: Page) => {
  const id = await page.locator('.read').evaluateAll((gs, mine) => gs.find((g) => (g as HTMLElement).dataset.voice !== mine && (g.querySelector('audio') as HTMLAudioElement | null)?.dataset.simple)?.getAttribute('data-voice'), both.part);
  expect(id, 'a second part with Emma files').toBeTruthy();
  return page.locator(`.read[data-voice="${id}"]`);
};
const deepPending = async (page: Page) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const group = await readAloud(page);
  const other = await otherPart(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await expect.poll(() => player(group).evaluate((a: HTMLAudioElement) => a.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Loading the next layer.');
  return { group, other };
};
test('D13: switching to another Emma part while Deep loads leaves no false fallback line', async ({ page }) => {
  const { group, other } = await deepPending(page);
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await page.waitForTimeout(2500);
  await expect(group.getByRole('status')).not.toHaveText(FALLBACK_LINE);
  expect(await spoken(page)).toEqual([]);
  await expect(other.getByRole('status')).toHaveText(READING);
});
test('D13: switching to a part with no Emma file speaks only that part', async ({ page }) => {
  const { group, other } = await deepPending(page);
  await other.locator('audio').evaluate((a: HTMLAudioElement) => delete a.dataset.simple);
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await page.waitForTimeout(2500);
  expect(await spoken(page)).toHaveLength(1);
  expect((await spoken(page) as { text: string }[])[0].text).not.toContain((await layerText(group, 'deep')).slice(0, 40));
  await expect(group.getByRole('status')).not.toHaveText(FALLBACK_LINE);
});
test("D13: another part's Stop leaves the device voice silent", async ({ page }) => {
  const { group, other } = await deepPending(page);
  await other.getByRole('button', { name: 'Stop' }).click();
  await page.waitForTimeout(2500);
  expect(await spoken(page)).toEqual([]);
  await expect(group.getByRole('status')).not.toHaveText(FALLBACK_LINE);
});

// D14, D15: the part's native Play control is another way to start a player, and a paused part keeps its queue.
const nativePlay = async (page: Page, group: ReturnType<Page['locator']>) => {
  await page.mouse.click(1, 1); // a learner gesture, as the native control's click is
  await group.locator('audio').evaluate((a: HTMLAudioElement) => a.play());
};
test('D14: native Play on another part while Deep loads leaves no device voice and no false line', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const group = await readAloud(page);
  const other = await otherPart(page);
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await expect(other.getByRole('status')).toHaveText(READING);
  await group.getByRole('button', { name: 'Read aloud' }).click(); // the other part is now paused, its controls still shown
  await expect(other.getByRole('status')).toHaveText('Paused.');
  await expect.poll(() => player(group).evaluate((a: HTMLAudioElement) => a.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Loading the next layer.');
  await nativePlay(page, other);
  await page.waitForTimeout(2500);
  expect(await spoken(page)).toEqual([]);
  await expect(group.getByRole('status')).toHaveText('Paused.');
  await expect(other.getByRole('status')).toHaveText(READING);
});

test('D15: a part paused by switching away resumes into Simple, then Deep, then Finished', async ({ page }) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  const other = await otherPart(page);
  await watchStatus(group);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText('Paused.');
  await nativePlay(page, group);
  await expect(group.getByRole('status')).toHaveText(READING);
  expect(await player(group).evaluate((a: HTMLAudioElement) => a.src.includes('-simple-'))).toBe(true);
  await seekToEnd(page, group);
  await expect.poll(() => isDeepPlaying(group)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Finished.');
  expect(await spoken(page)).toEqual([]);
  expect((await statuses(page)).filter((t) => t !== 'Loading the next layer.').filter((t, i, a) => t !== a[i - 1])).toEqual([READING, 'Paused.', READING, 'Finished.']);
});

// D16, D17: device speech starts only from a learner's click. No callback (a rejection, a media error) may start it.
test('D16: native Pause while Deep loads starts no speech and offers no button', async ({ page }) => {
  const { group } = await deepPending(page);
  await group.locator('audio').evaluate((a: HTMLAudioElement) => a.pause()); // the native Pause button does exactly this, outside the page's own helper
  await page.waitForTimeout(2500);
  expect(await spoken(page)).toEqual([]);
  await expect(group.getByRole('status')).toHaveText('Paused.');
  await expect(group.getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
});

test('D16: a late media error on a Deep file whose part was paused by switching starts no speech and offers no button', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }); // a late media error (a 404 would also fail the console guard)
  });
  const group = await readAloud(page);
  const other = await otherPart(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await expect.poll(() => player(group).evaluate((a: HTMLAudioElement) => a.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Loading the next layer.');
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await page.waitForTimeout(2500); // the error arrives after the switch
  expect(await spoken(page)).toEqual([]);
  await expect(group.getByRole('status')).toHaveText('Paused.');
  await expect(group.getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
});

test("D17: another part's native Play clears a part's offer, line and button", async ({ page }) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  const other = await otherPart(page);
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await expect(other.getByRole('status')).toHaveText(READING);
  await group.locator('audio').evaluate((a: HTMLAudioElement) => { a.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(REST);
  await group.getByRole('button', { name: REST_BUTTON }).click();
  await expect(group.getByRole('status')).toHaveText('Your device voice is reading the rest of this part.');
  expect(await spoken(page)).toHaveLength(1);
  await nativePlay(page, other);
  await expect(group.getByRole('status')).toHaveText('');
  await expect(group.getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
  await expect(other.getByRole('status')).toHaveText(READING);
});

// D18, D19: the status around the device voice's rest-of-part reading stays honest.
const offerRest = async (page: Page) => {
  await stub(page, [LOCAL]);
  const group = await readAloud(page);
  await group.locator('audio').evaluate((a: HTMLAudioElement) => { a.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(REST);
  return group;
};
const fire = (page: Page, event: 'onend' | 'onerror') =>
  page.evaluate((e) => (window as unknown as { utterances: Record<string, () => void>[] }).utterances.at(-1)?.[e]?.(), event);

test('D18: the rest button with no unread text on screen says Finished and speaks nothing', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.route(deepUrl, (route) => route.fulfill({ contentType: 'audio/mpeg', body: 'not audio' }));
  const group = await readAloud(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText(REST); // Deep failed: only Deep is unread
  await page.evaluate(() => delete document.documentElement.dataset.depth); // the page flips to Simple: Deep, the unread layer, is hidden
  await group.getByRole('button', { name: REST_BUTTON }).click();
  await expect(group.getByRole('status')).toHaveText('Finished.');
  expect(await spoken(page)).toEqual([]);
  await expect(group.getByRole('button', { name: REST_BUTTON })).toHaveCount(0);
});

test('D19: the line follows the device utterance to its end or its error, and a late event after a start says nothing', async ({ page }) => {
  const group = await offerRest(page);
  await group.getByRole('button', { name: REST_BUTTON }).click();
  await expect(group.getByRole('status')).toHaveText('Your device voice is reading the rest of this part.');
  await fire(page, 'onend');
  await expect(group.getByRole('status')).toHaveText('Finished.');
  await (await otherPart(page)).getByRole('button', { name: 'Read aloud' }).click(); // a new start clears the line
  await expect(group.getByRole('status')).toHaveText('');
  await fire(page, 'onend'); // the old utterance's late end
  await fire(page, 'onerror');
  await expect(group.getByRole('status')).toHaveText('');
});

test('D19: an error of the device voice is said honestly', async ({ page }) => {
  const group = await offerRest(page);
  await group.getByRole('button', { name: REST_BUTTON }).click();
  await fire(page, 'onerror');
  await expect(group.getByRole('status')).toHaveText('Your device voice could not read the rest of this part.');
});

// The activity comes after a section's Deep layer: lesson 2.5's "Ask for the shape" has a Deep file, so Emma reads it, not the device voice.
test('lesson 2.5 "Ask for the shape" with Deep shown plays its Deep file from /voice/, not the device voice', async ({ page }) => {
  await stub(page, [LOCAL]);
  const loaded: string[] = [];
  page.on('request', (r) => r.url().endsWith('.mp3') && loaded.push(new URL(r.url()).pathname));
  const file = (layer: string) => made.find(([, e]) => e.page === '/learn/prompting/format/' && e.part === 'ask-for-the-shape' && e.layer === layer)?.[0];
  await page.goto('/learn/prompting/format/?depth=deep');
  const group = page.locator('.read[data-voice="ask-for-the-shape"]');
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  // The player preloads Deep in a hidden clone, so only the shown <audio> says which layer plays.
  const shown = group.locator('audio:not([hidden])');
  const playing = (layer: string) => expect.poll(() => shown.evaluate((a: HTMLAudioElement, f) => new URL(a.src).pathname === f && a.readyState >= 1 && !a.paused, `/${file(layer)}`)).toBe(true);
  await playing('simple');
  await seekToEnd(page, group);
  await playing('deep');
  await seekToEnd(page, group);
  await expect(group.getByRole('status')).toHaveText('Finished.');
  expect(new Set(loaded)).toEqual(new Set([`/${file('simple')}`, `/${file('deep')}`]));
  expect(await spoken(page)).toEqual([]);
});

// A3-S1: the player's and the extractor's part ends. 2.5's Layer explorer follows the section's Deep and the activity, so neither read includes it.
const SHAPE = '/learn/prompting/format/?depth=deep';
const explorerHeading = (page: Page) => page.locator('main .layer-explorer').evaluate((el) => (el as HTMLElement).innerText.split('\n').find((l) => l.trim())!);

test('lesson 2.5 on the device voice speaks the section Simple plus Deep and not the layer explorer', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto(SHAPE);
  const group = page.locator('.read[data-voice="ask-for-the-shape"]');
  const part = (await readVoiceParts(page))['ask-for-the-shape'];
  const expected = [part.simple, part.deep].join('\n');
  const heading = await explorerHeading(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  const [said] = (await spoken(page)) as { text: string }[];
  expect(said.text).toBe(expected);
  expect(said.text).not.toContain('(opens in a new tab)');
  expect(said.text).not.toContain(heading);
});

test('voiceParts() for lesson 2.5 "Ask for the shape" with global Deep stops before the layer explorer', async ({ page }) => {
  await page.goto(SHAPE);
  const heading = await explorerHeading(page);
  const part = (await readVoiceParts(page))['ask-for-the-shape'];
  expect(part.simple.length).toBeGreaterThan(0);
  expect(part.deep.length).toBeGreaterThan(0);
  expect(part.deep).not.toContain(heading);
});

// L1: actual decorated Deep links keep their accessible names while device narration omits the decoration.
test('new-tab decoration is excluded from extraction and device narration', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto('/learn/ethics/bias/?depth=deep');
  const part = 'detectors-can-be-biased-too';
  const extracted = (await readVoiceParts(page))[part];
  expect(extracted.deep).not.toContain('(opens in a new tab)');
  const group = page.locator(`.read[data-voice="${part}"]`);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  const said = (await spoken(page)) as { text: string }[];
  expect(said[0].text).toBe([extracted.simple, extracted.deep].join('\n'));
  expect(said[0].text).not.toContain('(opens in a new tab)');
  for (const link of await page.locator(`[data-layer="deep"] a[href^="https:"]`).all())
    await expect(link).toHaveAccessibleName(/\(opens in a new tab\)/);
});

// The cue paints from a local SVG mask. Its empty content contributes no word or image to the accessibility tree.
test('external cues remain visible and decorative in every theme', async ({ page }) => {
  await page.goto('/about/');
  const link = page.locator('footer a[href="https://emmi.zone"]');
  for (const theme of ['light', 'dark', 'contrast', 'forced-colors']) {
    if (theme === 'forced-colors') await page.emulateMedia({ forcedColors: 'active' });
    else await page.evaluate((t) => document.documentElement.dataset.theme = t, theme);
    const cue = await link.evaluate((el) => {
      const style = getComputedStyle(el, '::after');
      return { content: style.content, width: parseFloat(style.width), height: parseFloat(style.height), mask: style.maskImage,
        colour: style.backgroundColor, linkColour: getComputedStyle(el).color };
    });
    expect(cue.content).toBe('""');
    expect(cue.width).toBeGreaterThan(0);
    expect(cue.height).toBeGreaterThan(0);
    expect(cue.colour).toBe(cue.linkColour);
    const image = /url\("?([^"\)]+)"?\)/.exec(cue.mask)?.[1];
    expect(image).toBeTruthy();
    const asset = await page.request.get(image!);
    expect(asset.ok()).toBe(true);
    expect(await asset.text()).toContain('<svg');
    await expect(link).toHaveAccessibleName('Emanuel Covasa (opens in a new tab)');
    expect(await link.ariaSnapshot()).not.toContain('- img');
  }
});

// Reading speed (design sheet 09-10-26): the Settings radios set html[data-speed]; Emma's playbackRate and the device
// voice's rate follow it, and a Speed button appears in a part's group once that part starts reading.
const speedGroup = (page: Page) => page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Reading speed' });
const withSpeed = (page: Page, speed: string) => page.addInitScript((s) => localStorage.setItem('nbl:settings', JSON.stringify({ speed: s })), speed);
const rate = (group: ReturnType<Page['locator']>) => group.locator('audio').evaluate((a: HTMLAudioElement) => a.playbackRate);

test('speed 3: a stored 1.5 is on <html> at first load, and Read aloud starts Emma at 1.5', async ({ page }) => {
  await stub(page, [LOCAL]);
  await withSpeed(page, '1.5');
  await page.goto(short.page);
  await expect(page.locator('html')).toHaveAttribute('data-speed', '1.5');
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).getByRole('status')).toHaveText('Emma is reading this part.');
  expect(await rate(emmaGroup(page))).toBe(1.5);
});

test('speed 4: choosing 1.2 while Emma plays changes the rate without a pause or a restart', async ({ page }) => {
  const long = made.filter(([, e]) => e.layer === 'simple').sort(([, a], [, b]) => b.seconds - a.seconds)[0][1]; // cannot end by itself during the test, under load
  const group = page.locator(`.read[data-voice="${long.part}"]`);
  await stub(page, [LOCAL]);
  await page.goto(long.page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText('Emma is reading this part.');
  const audio = group.locator('audio');
  await audio.evaluate((a: HTMLAudioElement) => {
    const seen: string[] = [];
    Object.assign(window, { seen });
    for (const t of ['pause', 'emptied']) a.addEventListener(t, () => seen.push(t));
    a.currentTime = Math.min(1, a.duration / 2);
  });
  const before = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
  await page.getByRole('button', { name: 'Settings' }).click();
  await speedGroup(page).getByLabel('1.2', { exact: true }).check();
  await expect.poll(() => rate(group)).toBe(1.2);
  const [seen, after, pitch] = await audio.evaluate((a: HTMLAudioElement) => [(window as unknown as { seen: string[] }).seen, a.currentTime, a.preservesPitch]);
  expect(seen).toEqual([]);
  expect(after as number).toBeGreaterThanOrEqual(before);
  expect(pitch).not.toBe(false);
});

test('speed 5: the device voice speaks at the chosen rate', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await withSpeed(page, '1.4');
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { utterances: { rate: number }[] }).utterances.map((u) => u.rate))).toEqual([1.4]);
});

test('speed 6: Speed appears after Stop in the part that starts, never on an idle page, never with no voice', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.goto(short.page);
  const speed = page.getByRole('button', { name: 'Speed', exact: true });
  await expect(speed).toHaveCount(0);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(speed).toHaveCount(1);
  await expect(emmaGroup(page).locator('button')).toHaveText(['Read aloud', 'Stop', 'Speed']);
  await expect(speed).toHaveAttribute('aria-haspopup', 'dialog');
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(speed).toHaveCount(1);
});

test('speed 6: with no voice at all, no Speed button', async ({ page }) => {
  await stub(page, []);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(firstSection(page).getByRole('status')).toHaveText('This device has no voice of its own, so it cannot read aloud here.');
  await expect(page.getByRole('button', { name: 'Speed', exact: true })).toHaveCount(0);
});

test('speed 7: Speed opens Settings on the checked radio, Emma plays on, and closing returns focus to Speed', async ({ page }) => {
  await stub(page, [LOCAL]);
  await withSpeed(page, '1.3');
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await expect(emmaGroup(page).getByRole('status')).toHaveText('Emma is reading this part.');
  await emmaGroup(page).locator('audio').evaluate((a: HTMLAudioElement) => {
    const seen: string[] = [];
    Object.assign(window, { seen });
    a.addEventListener('pause', () => seen.push('pause'));
  });
  const speed = emmaGroup(page).getByRole('button', { name: 'Speed', exact: true });
  await speed.click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(speedGroup(page).getByLabel('1.3', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(speed).toBeFocused();
});

test('speed 8: Speed never cancels speech', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await page.evaluate(() => {
    const calls: number[] = [];
    Object.assign(window, { calls });
    speechSynthesis.cancel = () => void calls.push(1);
  });
  await firstSection(page).getByRole('button', { name: 'Speed', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { calls: number[] }).calls)).toEqual([]);
});

test('speed 9: a rate set outside Settings is not stored, and the next part starts at the stored speed', async ({ page }) => {
  await stub(page, [LOCAL]);
  await withSpeed(page, '1.3');
  const group = await readAloud(page);
  const other = await otherPart(page);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect(group.getByRole('status')).toHaveText(READING);
  await group.locator('audio').evaluate((a: HTMLAudioElement) => { a.playbackRate = 2; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => localStorage.getItem('nbl:settings'))).toBe('{"speed":"1.3"}');
  await other.getByRole('button', { name: 'Read aloud' }).click();
  await expect(other.getByRole('status')).toHaveText(READING);
  expect(await rate(other)).toBe(1.3);
  await group.getByRole('button', { name: 'Read aloud' }).click();
  await expect.poll(() => rate(group)).toBe(1.3);
});

test('speed 10: at 320 px with the largest text, the Speed button is 44 px and the lesson does not scroll sideways', async ({ page }) => {
  await stub(page, [LOCAL]);
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ size: '5', spacing: 'wider' })));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  const box = await emmaGroup(page).getByRole('button', { name: 'Speed', exact: true }).boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('two speed changes while the device voice speaks each say the rest again from the last word, one cancel each', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { utterances: { onboundary: (e: { charIndex: number }) => void }[]; cancels: number };
    w.cancels = 0;
    speechSynthesis.cancel = () => void w.cancels++;
    Object.defineProperty(speechSynthesis, 'speaking', { value: true });
    w.utterances[0].onboundary({ charIndex: 5 });
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await speedGroup(page).getByLabel('1.2', { exact: true }).check();
  await page.evaluate(() => {
    const w = window as unknown as { utterances: { onboundary: (e: { charIndex: number }) => void; onend: () => void }[] };
    w.utterances[0].onend(); // the cancelled one ends late: the new reading goes on
    w.utterances[1].onboundary({ charIndex: 4 });
  });
  await speedGroup(page).getByLabel('1.3', { exact: true }).check();
  const [first, second, third, cancels] = await page.evaluate(() => {
    const w = window as unknown as { utterances: { text: string; rate: number }[]; cancels: number };
    return [...w.utterances, w.cancels];
  });
  expect((second as { text: string; rate: number }).text).toBe((first as { text: string }).text.slice(5));
  expect((second as { rate: number }).rate).toBe(1.2);
  expect((third as { text: string }).text).toBe((first as { text: string }).text.slice(9));
  expect((third as { rate: number }).rate).toBe(1.3);
  expect(cancels).toBe(2);
});

test('a speed change survives an engine that ends the old speech inside cancel', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { utterances: { onend: () => void }[] };
    speechSynthesis.cancel = () => w.utterances[w.utterances.length - 1].onend();
    Object.defineProperty(speechSynthesis, 'speaking', { value: true });
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await speedGroup(page).getByLabel('1.2', { exact: true }).check();
  const [count, rate] = await page.evaluate(() => {
    const u = (window as unknown as { utterances: { rate: number }[] }).utterances;
    return [u.length, u[u.length - 1].rate];
  });
  expect([count, rate]).toEqual([2, 1.2]);
});

test('after a device reading ends by itself, a speed change does not speak again', async ({ page }) => {
  await stub(page, [LOCAL]);
  await noEmma(page);
  await page.goto(lesson);
  await firstSection(page).getByRole('button', { name: 'Read aloud' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { utterances: { onend?: () => void }[] };
    Object.defineProperty(speechSynthesis, 'speaking', { value: true }); // Firefox: another tab may be speaking
    w.utterances[0].onend?.();
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await speedGroup(page).getByLabel('1.2', { exact: true }).check();
  expect(await page.evaluate(() => (window as unknown as { utterances: object[] }).utterances.length)).toBe(1);
});

test('Speed puts focus on the first radio when the stored speed is not one of the six', async ({ page }) => {
  await stub(page, [LOCAL]);
  await withSpeed(page, '999');
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await emmaGroup(page).getByRole('button', { name: 'Speed', exact: true }).click();
  await expect(speedGroup(page).getByLabel('Normal', { exact: true })).toBeFocused();
});

test('Speed opens the disclosure first when the learner closed it', async ({ page }) => {
  await stub(page, [LOCAL]);
  await withSpeed(page, '1.3');
  await page.goto(short.page);
  await emmaGroup(page).getByRole('button', { name: 'Read aloud' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings details.group').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = false)));
  await page.keyboard.press('Escape');
  await emmaGroup(page).getByRole('button', { name: 'Speed', exact: true }).click();
  await expect(speedGroup(page).getByLabel('1.3', { exact: true })).toBeFocused();
});
