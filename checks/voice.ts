// check:voice. Emma's audio (scripts/voice-tool/voice.ts) against the built <target>, in both directions. Every file under
// voice/ is listed in voice/manifest.json, every listed file exists, and its hash is the current read text of its page, part
// and layer (checks/voice-parts.ts). And every part and layer that has read text has a file: only core parts carry a
// `.read[data-voice]` group (probed on all 25 lessons), so no kind of part is exempt, and a layer that no group reads
// fails too. Then a headless pass presses Read aloud on every part in Simple and in Deep with the media and speech
// stubbed: each part must play exactly its layers' files in order and never call the device voice. A page that fails the
// static half skips the pass. No script may carry eSpeak NG (GPL-3.0) or phonemizer code: they run on the Mac that makes
// the audio, never in a browser.
import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { pages, serve } from './serve.ts';
import { readVoiceOrphans, readVoiceParts } from './voice-parts.ts';

const NAME = 'voice';
type Entry = { page: string; part: string; layer: string; hash: string; bytes: number };
type Parts = Record<string, Record<string, string>>;
const MODES = [
  { name: 'Simple', query: '', layers: ['simple'] },
  { name: 'Deep', query: '?depth=deep', layers: ['simple', 'deep'] },
];
// Plays end at once and the device has one local voice, so a fall back to the device voice reaches speak().
const STUB = `
  const played = [], spoken = [], voice = { name: 'Device', lang: 'en-GB', localService: true, voiceURI: 'device' };
  Object.assign(window, { played, spoken });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [voice], speak: (u) => spoken.push(u.text), cancel() {}, addEventListener() {} } });
  HTMLMediaElement.prototype.play = function () {
    delete this.ended;
    played.push(new URL(this.getAttribute('src'), location).pathname);
    setTimeout(() => { Object.defineProperty(this, 'ended', { value: true, configurable: true }); this.dispatchEvent(new Event('ended')); });
    return Promise.resolve();
  };`;

const findings: string[] = [];
let [pageCount, partCount, fileCount] = [0, 0, 0];

async function pressReadAloud(browser: Browser, origin: string, page: string, parts: Parts, fileOf: (part: string, layer: string) => string | undefined) {
  for (const mode of MODES) {
    const tab = await browser.newPage();
    await tab.addInitScript(STUB);
    await tab.goto(origin + page + mode.query, { waitUntil: 'networkidle' });
    for (const [part, layers] of Object.entries(parts)) {
      const expected = mode.layers.filter((l) => layers[l]?.trim()).map((l) => `/${fileOf(part, l)}`);
      if (!expected.length) continue;
      await tab.evaluate('played.length = spoken.length = 0');
      await tab.locator(`.read[data-voice="${part}"] [data-read="start"]`).click();
      await tab.waitForFunction(`played.length >= ${expected.length} || spoken.length`, undefined, { timeout: 2000 }).catch(() => {}); // short: the check below reports it
      const { played, spoken } = await tab.evaluate<{ played: string[]; spoken: string[] }>('({ played, spoken })');
      if (JSON.stringify(played) !== JSON.stringify(expected) || spoken.length)
        findings.push(`${NAME}: ${page} ${part} [${mode.name}]: played ${JSON.stringify(played)}, expected ${JSON.stringify(expected)}, device voice called ${spoken.length} times`);
    }
    await tab.close();
  }
}

for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['dist']) {
  if (!pages(target).length) {
    findings.push(`${NAME}: nothing to check in ${target}`);
    continue;
  }
  for (const file of globSync('**/*.{js,mjs,wasm}', { cwd: target }).sort())
    if (/espeak|phonemizer/i.test(readFileSync(join(target, file), 'latin1'))) findings.push(`${NAME}: ${file}: eSpeak NG or phonemizer code`);
  for (const file of globSync('**/*', { cwd: target }).sort())
    if (!file.startsWith('voice/') && /(?:^|\/)(?:node_modules|voice-tool)(?:\/|$)|espeak|phonemizer|kokoro|onnxruntime|\.(?:onnx|bin|wasm)$/i.test(file))
      findings.push(`${NAME}: ${file}: generator asset in build`);
  const listed = join(target, 'voice/manifest.json');
  const manifest: Record<string, Entry> = existsSync(listed) ? JSON.parse(readFileSync(listed, 'utf8')) : {};
  for (const file of globSync('voice/**/*', { cwd: target }).sort())
    if (statSync(join(target, file)).isFile() && file !== 'voice/manifest.json' && (!file.endsWith('.mp3') || !manifest[file]))
      findings.push(`${NAME}: ${file}: not in voice/manifest.json`);
  const { origin, close } = await serve(target);
  const browser = await chromium.launch();
  try {
    const read: Record<string, Parts> = {};
    const stale = new Set<string>(); // pages whose files are already reported: the browser pass would only repeat it
    for (const page of pages(target)) {
      const tab = await browser.newPage();
      await tab.goto(origin + page, { waitUntil: 'networkidle' });
      read[page] = await readVoiceParts(tab);
      for (const { layer, text } of await readVoiceOrphans(tab)) (stale.add(page), findings.push(`${NAME}: ${page} ${layer} "${text}": outside every read part, no Emma file`));
      await tab.close();
    }
    for (const [file, { page, part, layer, hash, bytes }] of Object.entries(manifest)) {
      const path = join(target, file);
      const size = existsSync(path) ? statSync(path).size : undefined;
      if (size !== bytes) (stale.add(page), findings.push(size === undefined ? `${NAME}: ${file}: missing` : `${NAME}: ${file}: ${size} bytes, manifest says ${bytes}`));
      const text = read[page]?.[part]?.[layer];
      if (text === undefined || createHash('sha256').update(text).digest('hex') !== hash) {
        findings.push(`${NAME}: ${file}: stale, the ${layer} text of ${page} ${part} changed`);
        stale.add(page);
      }
    }
    for (const [page, parts] of Object.entries(read)) {
      if (!Object.keys(parts).length) continue;
      pageCount++;
      partCount += Object.keys(parts).length;
      const fileOf = (part: string, layer: string) => Object.entries(manifest).find(([, e]) => e.page === page && e.part === part && e.layer === layer)?.[0];
      for (const [part, layers] of Object.entries(parts))
        for (const [layer, text] of Object.entries(layers)) {
          if (!text.trim()) continue;
          if (fileOf(part, layer)) fileCount++;
          else (stale.add(page), findings.push(`${NAME}: ${page} ${part} ${layer}: no Emma file`));
        }
      if (!stale.has(page)) await pressReadAloud(browser, origin, page, parts, fileOf);
    }
  } finally {
    await browser.close();
    await close();
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else console.log(`${NAME}: ${pageCount} pages, ${partCount} parts, ${fileCount} files, Simple and Deep: all Emma`);
