import { globSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { recorded, recording } from '../../src/lesson-schema.ts';
import { fill, summary, WORDS } from '../../src/lib/still-know-name.ts';
import { expect, test } from '../guard.ts';
import { checkShell } from '../shell.ts';
type Call = { at: string; request: { max_tokens: number }; response: { model: string; usage: { prompt_tokens: number; completion_tokens: number } } };
const URL = '/learn/how-ai-works/attention-and-the-context-window/';
const R = recording.parse(JSON.parse(readFileSync('data/recorded/R-1.8.json', 'utf8')));
const LABELS = (recorded.parse(load(readFileSync('content/how-ai-works/attention-and-the-context-window/recorded.yaml', 'utf8')))['R-1.8'].runs ?? []).map((r) => r.answer);
const { kept, dropped } = R.trim as { kept: { content: string }[]; dropped: { content: string }[][] };
const cut = dropped.flat();
const runs = R.variants[0].runs.map((r) => ({ reply: r.reply, call: r.calls?.at(-1) as Call }));
const card = R.model.card as { max_context_length: number; default_model_temperature: number };
const num = (n: number) => n.toLocaleString('en-IE');
const day = (d: string) => new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const words = kept.flatMap((m) => [...new Intl.Segmenter('en', { granularity: 'word' }).segment(m.content)].filter((s) => s.isWordLike)).length;
test('the shell: prediction first, keyboard alone, text version, stillness, five choices at most', async ({ page }) => {
  await checkShell(page, URL);
});
test('T4, T5 and T7: the box, every answer and every value are the recording, and no count about the learner', async ({ page }) => {
  await page.goto(URL);
  const box = page.locator('.still-know-name');
  for (const [q, i] of [[WORDS.know, 1], [WORDS.sent, 3]] as const) await box.getByRole('group', { name: q.question }).getByRole('radio', { name: q.options[i] }).check();
  await box.getByRole('button', { name: WORDS.reveal }).click();
  await expect(box.locator('.picked')).toHaveText(`${WORDS.know.said[1]} ${WORDS.sent.said[3]}`);
  // T5: the cut group is the messages before the kept ones, the window the rest, in order; the name marker sits on message 1 only; dashed against solid.
  expect(await box.locator('.cut .msg span').allTextContents()).toEqual(cut.map((m) => m.content));
  expect(await box.locator('.window .msg span').allTextContents()).toEqual(kept.map((m) => m.content));
  expect(await box.locator('.name-here').allTextContents()).toEqual([WORDS.nameHere]);
  await expect(box.locator('.cut .msg').first().locator('.name-here')).toHaveCount(1);
  const style = (sel: string) => box.locator(sel).evaluate((e) => getComputedStyle(e).borderTopStyle);
  expect([await style('.cut'), await style('.window')]).toEqual(['dashed', 'solid']);
  // T4: Run 1 and every run under "Show all runs" are the stored answers and values, worked out here from the JSON.
  const shown = [runs[0], ...runs];
  const rows = await Promise.all(['reply', 'check', 'meta', 'tokens', 'settings'].map((c) => box.locator(`.run .${c}`).allTextContents()));
  expect(rows).toEqual([
    shown.map((r) => r.reply),
    [LABELS[0], ...LABELS].map((l) => WORDS.check[l]),
    shown.map(({ call: { at, response } }) => `${R.model.name} (${response.model}), on ${R.model.host}. ${day(at)}, ${at.slice(11, 16)} UTC.`),
    shown.map(({ call: { response: { usage } } }) => `Tokens, as Mistral counted them: ${num(usage.prompt_tokens)} sent and ${num(usage.completion_tokens)} in this answer.`),
    shown.map(({ call }) => fill(WORDS.settings, { value: String(card.default_model_temperature), date: day(R.date), max_tokens: num(call.request.max_tokens) })),
  ]);
  for (const line of [
    fill(WORDS.model, { 'model name': R.model.name, date: day(R.date) }), fill(WORDS.moreCut, { K: num(cut.length - 1) }), fill(WORDS.words, { W: num(words) }),
    fill(WORDS.sentTokens, { P: num(runs[0].call.response.usage.prompt_tokens) }), fill(WORDS.earlier, { M: num(kept.length - 3) }),
    fill(WORDS.most, { max_context_length: num(card.max_context_length), 'date read': day(R.date) }),
  ])
    await expect(box.getByText(line, { exact: true })).toHaveCount(1);
  // T7: the summary sentences follow the labels, and the page's own words hold no "x of y" count and no "%".
  expect(await box.locator('.summary p').allTextContents()).toEqual(summary(LABELS));
  const ours = await box.evaluate((e) => [e.cloneNode(true) as HTMLElement].map((c) => (c.querySelectorAll('.reply').forEach((r) => r.remove()), c.textContent))[0]);
  expect(ours).not.toMatch(/\d[\d,]* (?:of|out of) \d|%/);
});
// T11 (no recording, only the pending note) is in e2e/recorded/still-know-name.spec.ts, on the fixture build.
test('T12: as text, every message and every answer is written out, none behind a closed disclosure', async ({ page }) => {
  await page.goto(URL);
  await page.locator('.still-know-name .shell-text input').check();
  const out = page.locator('.still-know-name :is(.cut, .window) .msg span, .still-know-name .run .reply');
  await expect(out).toHaveCount(cut.length + kept.length + runs.length + 1);
  for (const el of await out.all()) await expect(el).toBeVisible();
});
test('no key, auth header or account id in any recorded file or built page', () => {
  const files = [...globSync('data/recorded/*.json'), ...globSync('dist/**/*.{html,json}')];
  const secret = /\bsk-[\w-]{8,}|\bbearer\s+\w|\bauthorization["']?\s*:|\bapi[_-]?key\b|x-api-key|"(?:org|organization|account|workspace|project|user)_?id"/i;
  // A Mistral key is 32 letters and digits, mixed case; a response id is lower-case hex, so it does not match.
  const key = /\b(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32}\b/;
  expect(files.filter((f) => f.endsWith('R-1.8.json')).length).toBe(1);
  expect(files.filter((f) => secret.test(readFileSync(f, 'utf8')))).toEqual([]);
  // Anthropic's encrypted_content and signature are opaque blobs that can look like a key: only their values are skipped.
  // The local llama.cpp server's made-up response.id (chatcmpl-<32 letters and digits>) is not a secret: only an id with that prefix is skipped.
  const skipped = (k: string, v: unknown) => k === 'encrypted_content' || k === 'signature' || (k === 'id' && typeof v === 'string' && v.startsWith('chatcmpl-'));
  const hasKey = (data: unknown) => key.test(JSON.stringify(data, (k, v) => (skipped(k, v) ? '' : v)));
  const recordings = globSync('data/recorded/*.json');
  const r15 = JSON.parse(readFileSync('data/recorded/R-1.5.json', 'utf8'));
  expect(recordings).toEqual(expect.arrayContaining(['data/recorded/R-1.5.json', 'data/recorded/R-1.8.json']));
  expect(hasKey({ ...r15, message: `${r15.message} ${'Aa1B'.repeat(8)}` })).toBe(true);
  const planted = 'Aa1B'.repeat(8);
  expect(hasKey({ ...r15, id: `chatcmpl-${planted}` })).toBe(false);
  expect(hasKey({ ...r15, id: planted })).toBe(true);
  expect(hasKey({ ...r15, other: `chatcmpl-${planted}` })).toBe(true);
  expect(recordings.filter((f) => hasKey(JSON.parse(readFileSync(f, 'utf8'))))).toEqual([]);
});
