// Trains lesson 1.9's two doodle models (brief, Interactive; pack I4 to I8, I11). Run by hand, once, like
// scripts/record.ts, never by the build or verify: from the repo root with Node 22, `node scripts/train-doodle.ts`. It
// reads the first 4 MiB of six Quick, Draw! files (public, no key), stops unless each matches its pinned SHA-256, and
// writes three files once, never overwriting (git keeps the old). Its tests mock the network.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chances, guess, render, rows, words, type Drawing, type Model } from '../src/lib/doodle.ts';

const [KINDS, COPY, BYTES] = [['apple', 'car', 'cat', 'fish', 'house', 'umbrella'], ['apple', 'house', 'umbrella'], 4194304];
const address = (kind: string) => `https://storage.googleapis.com/quickdraw_dataset/full/simplified/${kind}.ndjson`;
const PINS: Record<string, string> = {
  apple: 'd90dec739e92d9e51d5eca58bfb4aee9fceab8c42653bd0850e7a408dc65777e',
  car: 'c618d29401600c6a3adff120b52725b03a84b3eb066fac181d87bdd054c50ff3',
  cat: '0b598e415cf76008ab1ace10d7805cd2e6b6c495c32c19e2c2b083295bfbcdf8',
  fish: 'cc5490bce42f4b0951674fc3455be5b405ac760de0330a7f190bcc1acdccb66b',
  house: '7b8eedd162848f67a40ca7868f7d84dba2815af53f62f4f368f66432448e7553',
  umbrella: '75279c274487d914d57c7374ecb0e476ebbddab888f10a22d328eb87720d3050',
};
// I8: a line a person skipped after looking at it, with the reason. Empty: the three picks were looked at and are fine.
const SKIP: { kind: string; line: number; reason: string }[] = [];
export const OUT = { six: 'data/doodle/six-kinds.weights.json', three: 'data/doodle/three-kinds.weights.json', data: 'data/interactive/doodle-guesser.json' };

type Line = { line: number; recognized: boolean; drawing: Drawing; country: string };
const sha = (b: string | Uint8Array) => createHash('sha256').update(b).digest('hex');
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

// I6: 300 rounds of full-batch gradient descent, step 0.5, from all zeros; every number then rounded to 4 places.
function fit(kinds: string[], data: { x: number[]; k: number }[]): Model {
  const zeros = () => [kinds.map(() => new Array<number>(784).fill(0)), new Array<number>(kinds.length).fill(0)] as const;
  const [w, b] = zeros();
  for (let round = 0; round < 300; round++) {
    const [gw, gb] = zeros();
    for (const { x, k } of data)
      chances({ kinds, b, w }, x).forEach((p, c) => {
        const diff = p - (c === k ? 1 : 0);
        gb[c] += diff;
        for (let j = 0; j < 784; j++) if (x[j]) gw[c][j] += diff * x[j];
      });
    kinds.forEach((_, c) => {
      b[c] -= 0.5 * (gb[c] / data.length);
      for (let j = 0; j < 784; j++) w[c][j] -= 0.5 * (gw[c][j] / data.length);
    });
  }
  return { kinds, b: b.map(round4), w: w.map((r) => r.map(round4)) };
}

export async function run(root = '.', fetcher: typeof fetch = fetch) {
  for (const f of Object.values(OUT)) if (existsSync(join(root, f))) throw new Error(`${f} exists: nothing was requested. Remove it first; git keeps the old one.`);
  const files: Record<string, Line[]> = {};
  const slice: { kind: string; address: string; bytes: number; sha256: string; learning: number[]; testing: number[] }[] = [];
  for (const kind of KINDS) {
    const res = await fetcher(address(kind), { headers: { Range: `bytes=0-${BYTES - 1}` } });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (res.status !== 206 || bytes.length !== BYTES || sha(bytes) !== PINS[kind])
      throw new Error(`${kind}: HTTP ${res.status}, ${bytes.length} bytes, SHA-256 ${sha(bytes)} is not the pinned range: nothing was trained or written`);
    // Only complete lines count: the range cuts the last one. Line numbers count from 1.
    files[kind] = Buffer.from(bytes).toString('utf8').split('\n').slice(0, -1).map((text, i) => {
      const { word, recognized, drawing, countrycode } = JSON.parse(text);
      return { line: i + 1, recognized: word === kind && recognized === true, drawing, country: countrycode };
    });
    const used = files[kind].filter((l) => l.recognized).slice(0, 2500);
    if (used.length < 2500) throw new Error(`${kind}: only ${used.length} recognised lines`);
    slice.push({ kind, address: address(kind), bytes: BYTES, sha256: PINS[kind], learning: [used[0].line, used[1999].line], testing: [used[1999].line + 1, used[2499].line] });
  }
  const part = (kind: string, n: 0 | 1) => {
    const [from, to] = slice[KINDS.indexOf(kind)][n ? 'testing' : 'learning'];
    return files[kind].filter((l) => l.recognized && l.line >= from && l.line <= to);
  };
  const set = (kinds: string[], n: 0 | 1) => kinds.flatMap((kind, k) => part(kind, n).map((l) => ({ x: render(l.drawing), k, kind })));

  const started = performance.now();
  const [learnSix, testSix] = [set(KINDS, 0), set(KINDS, 1)];
  const [six, three] = [fit(KINDS, learnSix), fit(COPY, set(COPY, 0))];
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const right = (m: Model, test: { x: number[]; kind: string }[]) => test.filter((t) => m.kinds[guess(chances(m, t.x))] === t.kind).length;
  const testThree = testSix.filter((t) => COPY.includes(t.kind));
  const unlearned = testSix.filter((t) => !COPY.includes(t.kind)).map((t) => chances(three, t.x));
  const countries = new Map<string, number>();
  for (const kind of KINDS) for (const l of part(kind, 0)) countries.set(l.country, (countries.get(l.country) ?? 0) + 1);

  // I8: for car, cat and fish, the first testing line the six-kind model gives its own kind 0.9 or more, after the skips.
  const [examples, skipped]: [{ kind: string; line: number; drawing: Drawing; before: object[] }[], typeof SKIP] = [[], []];
  for (const kind of ['car', 'cat', 'fish']) {
    const k = KINDS.indexOf(kind);
    const before: object[] = [];
    for (const l of files[kind].filter((l) => l.line >= slice[k].testing[0] && l.line <= slice[k].testing[1])) {
      const passes = l.recognized && chances(six, render(l.drawing))[k] >= 0.9;
      const skip = SKIP.find((s) => s.kind === kind && s.line === l.line);
      if (skip && !passes) throw new Error(`SKIP ${kind} line ${l.line} does not pass the rule`);
      if (passes && !skip) {
        examples.push({ kind, line: l.line, drawing: l.drawing, before });
        break;
      }
      if (skip) skipped.push(skip);
      before.push(l.recognized ? { line: l.line, recognized: true, drawing: l.drawing } : { line: l.line, recognized: false });
    }
    if (examples.at(-1)?.kind !== kind) throw new Error(`${kind}: no testing line passes the rule`);
  }

  const text = (x: object) => `${JSON.stringify(x)}\n`;
  const [sixText, threeText] = [text(six), text(three)];
  const heldBack = { six: { right: right(six, testSix), total: testSix.length }, three: { right: right(three, testThree), total: testThree.length } };
  const top = [...countries].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5).map(([code, n]) => ({ code, n }));
  const data = text({ slice, copyKinds: COPY, heldBack, countries: { count: countries.size, top }, examples, skipped, weights: { six: sha(sixText), three: sha(threeText) } });
  const written = [[OUT.six, sixText], [OUT.three, threeText], [OUT.data, data]];
  for (const [f, t] of written) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), t, { flag: 'wx' });
  }

  // The summary for the PR body.
  const said = (m: Model, d: Drawing) => rows(m, chances(m, render(d))).map((r) => `${r.kind} ${words(r.chance)}`).join(', ');
  const named = COPY.map((c) => `${c} ${unlearned.filter((p) => COPY[guess(p)] === c).length}`).join(', ');
  console.log(`training: ${seconds} s for both models`);
  for (const s of slice) console.log(`slice ${JSON.stringify(s)}`);
  console.log(`held back, right and total: six-kind model ${heldBack.six.right} ${heldBack.six.total}; copy on its own kinds ${heldBack.three.right} ${heldBack.three.total}`);
  console.log(`copy on ${unlearned.length} held-back car, cat and fish: named ${named}; top chance 0.9 or more ${unlearned.filter((p) => Math.max(...p) >= 0.9).length}`);
  for (const e of examples) console.log(`example ${e.kind}, line ${e.line}, ${e.before.length} lines before it\n  six-kind model: ${said(six, e.drawing)}\n  copy: ${said(three, e.drawing)}`);
  console.log(`skipped: ${skipped.length}; countries: ${countries.size}, top ${top.map((c) => `${c.code} ${c.n}`).join(', ')}`);
  for (const [f, t] of written) console.log(`${f}: ${Buffer.byteLength(t)} bytes, ${gzipSync(t).length} gzipped, SHA-256 ${sha(t)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
