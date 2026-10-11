// T8 (lesson 1.9 brief): scripts/train-doodle.ts's guards, with the network mocked. Nothing here downloads or trains.
vi.hoisted(() => {
  globalThis.fetch = vi.fn(() => { throw new Error('unmocked network call'); }) as typeof fetch;
});
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { OUT, run } from './train-doodle.ts';

const dirs: string[] = [];
const root = () => {
  dirs.push(mkdtempSync(join(tmpdir(), 'doodle-')));
  return dirs[dirs.length - 1];
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test('T8 a range with a wrong SHA-256 stops it before training and before anything is written', async () => {
  const dir = root();
  const fetcher = vi.fn(async () => new Response(new Uint8Array(4194304), { status: 206 }));
  await expect(run(dir, fetcher)).rejects.toThrow(/^apple: HTTP 206, 4194304 bytes, SHA-256 bb9f8df6\w+ is not the pinned range: nothing was trained or written$/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(readdirSync(dir, { recursive: true })).toEqual([]);
});

test('T8 an existing output file stops it before any request', async () => {
  for (const f of Object.values(OUT)) {
    const dir = root();
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), 'old\n');
    const fetcher = vi.fn();
    await expect(run(dir, fetcher)).rejects.toThrow(`${f} exists: nothing was requested`);
    expect(fetcher).not.toHaveBeenCalled();
  }
});
