// Emma's audio, made once on this Mac (decision 13, amended 28-09-26): never run by the build or verify. For each part and
// layer of the built lessons, it synthesises the exact read text (checks/voice-parts.ts) with Kokoro-82M and the bf_emma
// voice, encodes MP3, and records the file in public/voice/manifest.json. A part whose text hash is unchanged is skipped.
// eSpeak NG (GPL-3.0, inside phonemizer) runs here only; check:voice keeps it out of dist.
//
// Usage, from the repo root with Node 22 and ffmpeg on PATH. The first run downloads the pinned model (92 MB) to
// ~/.cache/stillpool-voice; every later run is offline.
//   bun install --frozen-lockfile --cwd scripts/voice-tool
//   bun run build && node scripts/voice-tool/voice.ts what-ai-is-and-is-not    (one or more lesson slugs; none: all)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { env } from '@huggingface/transformers';
import { chromium } from '@playwright/test';
import { KokoroTTS, TextSplitterStream } from 'kokoro-js';
import { pages, serve } from '../../checks/serve.ts';
import { readVoiceParts } from '../../checks/voice-parts.ts';

const REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const REV = '1939ad2a8e416c0acfeecc08a694d14ef25f2231';
const VOICE = 'bf_emma';
const ASSETS = {
  'config.json': 'df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f',
  'tokenizer.json': '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34',
  'tokenizer_config.json': 'be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20',
  'onnx/model_quantized.onnx': 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478',
};
// kokoro-js reads the voice from its own package (pinned by scripts/voice-tool/bun.lock); it must be REV's file.
const VOICE_SHA = '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73';
// MP3 mono at Kokoro's 24 kHz, 48 kbps CBR: every browser plays it; bitexact keeps a rerun byte-identical.
const MP3 = ['-c:a', 'libmp3lame', '-b:a', '48k', '-map_metadata', '-1', '-fflags', '+bitexact', '-f', 'mp3'];
const RATE = 24000;
const MANIFEST = 'public/voice/manifest.json';

type Entry = { page: string; part: string; layer: string; hash: string; model: string; voice: string; date: string; seconds: number; bytes: number };
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

const cache = join(homedir(), '.cache/stillpool-voice');
for (const [name, expected] of Object.entries(ASSETS)) {
  const file = join(cache, 'kokoro', name);
  if (!existsSync(file)) {
    const response = await fetch(`https://huggingface.co/${REPO}/resolve/${REV}/${name}`);
    if (!response.ok) throw new Error(`Model file ${name}: HTTP ${response.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  if (sha(readFileSync(file)) !== expected) throw new Error(`Model file ${name}: SHA-256 mismatch, delete ${file} and rerun`);
}
const voiceFile = join(import.meta.dirname, `node_modules/kokoro-js/voices/${VOICE}.bin`);
if (sha(readFileSync(voiceFile)) !== VOICE_SHA) throw new Error(`${voiceFile}: SHA-256 mismatch`);
Object.assign(env, { localModelPath: cache, allowRemoteModels: false });
const tts = await KokoroTTS.from_pretrained('kokoro', { dtype: 'q8', device: 'cpu' });

const speak = async (text: string) => {
  const chunks: Buffer[] = [];
  // kokoro-js 1.2.1's stream(string) never closes its splitter and waits after the last sentence; a closed one ends.
  const sentences = new TextSplitterStream();
  sentences.push(text);
  sentences.close();
  for await (const { audio } of tts.stream(sentences, { voice: VOICE })) chunks.push(Buffer.from(audio.audio.buffer, audio.audio.byteOffset, audio.audio.byteLength));
  const pcm = Buffer.concat(chunks); // 32-bit float samples
  const mp3 = spawnSync('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', ...MP3, '-'], { input: pcm, maxBuffer: 1 << 28 });
  if (mp3.status !== 0) throw new Error(`ffmpeg: ${mp3.stderr || mp3.error}`);
  return { mp3: mp3.stdout, seconds: Math.round((pcm.length / 4 / RATE) * 100) / 100 };
};

const only = process.argv.slice(2);
const manifest: Record<string, Entry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const { origin, close } = await serve('dist');
const browser = await chromium.launch();
try {
  for (const page of pages('dist').filter((p) => !only.length || only.some((slug) => p.endsWith(`/${slug}/`)))) {
    const tab = await browser.newPage();
    await tab.goto(origin + page, { waitUntil: 'networkidle' });
    const parts = await readVoiceParts(tab);
    await tab.close();
    const wanted = new Set<string>();
    for (const [part, layers] of Object.entries(parts))
      for (const [layer, text] of Object.entries(layers)) {
        if (!text.trim()) continue;
        const hash = sha(text);
        const file = `voice${page}${part}-${layer}-${hash.slice(0, 12)}.mp3`;
        wanted.add(file);
        if (manifest[file] && existsSync(join('public', file))) continue; // same text, same file: skip
        const { mp3, seconds } = await speak(text);
        mkdirSync(dirname(join('public', file)), { recursive: true });
        writeFileSync(join('public', file), mp3);
        const date = new Date().toISOString().slice(0, 10);
        manifest[file] = { page, part, layer, hash, model: `${REPO}@${REV} q8`, voice: VOICE, date, seconds, bytes: statSync(join('public', file)).size };
        console.log(`${file}  ${seconds} s  ${mp3.length} bytes`);
      }
    // A changed or removed part's old file goes, so no stale audio ships.
    for (const file of Object.keys(manifest))
      if (manifest[file].page === page && !wanted.has(file)) {
        rmSync(join('public', file), { force: true });
        delete manifest[file];
      }
  }
} finally {
  await browser.close();
  await close();
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
const all = Object.values(sorted);
console.log(`total: ${all.length} files  ${all.reduce((n, e) => n + e.bytes, 0)} bytes  ${(all.reduce((n, e) => n + e.seconds, 0) / 60).toFixed(1)} min`);
