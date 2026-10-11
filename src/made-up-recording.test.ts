import { globSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from 'vitest';
import { recorded, recording } from './lesson-schema.ts';
const rec = recording.parse(JSON.parse(readFileSync('data/recorded/R-1.6.json', 'utf8')));
const checks = recorded.parse(load(readFileSync('content/how-ai-works/why-they-make-things-up/recorded.yaml', 'utf8')))['R-1.6'];
const bad = (change: (r: typeof rec) => void) => { const copy = structuredClone(rec); change(copy); return copy; };
function requestOkay(r: typeof rec) {
  expect(r.message).toBe('Name three studies published since 2020 on whether taking notes by hand or on a laptop affects how much students remember from a lecture. For each study, give the title, the authors, the year, the journal and the main finding. Use plain text, with each study on its own line.');
  expect(r.variants).toHaveLength(2); expect(r.variants.map((v) => v.runs.length)).toEqual([10, 10]);
  for (const [i, v] of r.variants.entries()) for (const run of v.runs) {
    const call = run.calls?.at(-1);
    expect(call?.at).toMatch(/^2026-09-28T.*Z$/);
    const q = call?.request as Record<string, unknown>;
    expect(q.messages).toEqual([{ role: 'user', content: r.message }]);
    for (const key of ['tools', 'temperature']) expect(q).not.toHaveProperty(key);
    expect(q.max_tokens).toBe(i ? 4096 : 16000);
    if (i === 0) {
      expect(q.model).toBe('claude-sonnet-5'); expect(q.output_config).toEqual({ effort: 'high' });
      expect(q.thinking).toEqual({ type: 'adaptive', display: 'summarized' });
      expect(q).not.toHaveProperty('top_p'); expect(q).not.toHaveProperty('top_k');
      expect((call?.response as any).stop_reason).not.toBe('max_tokens');
      expect(run.reply).toBe((call?.response as any).content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join(''));
    } else {
      expect(q.model).toBe('ministral-14b-2512'); expect(q.safe_prompt).not.toBe(true);
      for (const field of ['random_seed', 'prompt_mode', 'reasoning_effort']) expect(q).not.toHaveProperty(field);
      const answer = (call?.response as any).choices[0];
      expect(answer.finish_reason).not.toBe('length'); expect(typeof answer.message.content).toBe('string');
      expect(run.reply).toBe(answer.message.content);
    }
    expect(typeof (call?.response as any).model).toBe('string');
  }
  expect(typeof (r.variants[1].model?.card as any)?.default_model_temperature).toBe('number');
}
test('T1 recording requests, responses and unchanged answers', () => requestOkay(rec));
test('T1 known-bad requests and response fail', () => {
  for (const change of [(r: typeof rec) => { (r.variants[1].runs[0].calls![0].request as any).messages.unshift({ role: 'system', content: 'x' }); }, (r: typeof rec) => { (r.variants[0].runs[0].calls![0].request as any).temperature = 0.5; }, (r: typeof rec) => { (r.variants[1].runs[0].calls![0].response as any).choices[0].message.content = ['x']; }]) expect(() => requestOkay(bad(change))).toThrow();
});
const answers = checks!.answers!;
const replyLines = (maker: number, n: number) => rec.variants[maker].runs[n].reply.split(/\r?\n/).filter((s) => s.trim());
type Checks = typeof answers;
function checksOkay(all: Checks) {
  expect(checks?.checked).toBe('2026-09-28'); expect(checks?.by).toBeTruthy(); expect(all).toHaveLength(20);
  for (const [maker, v] of rec.variants.entries()) for (const n of v.runs.keys()) {
    const c = all.find((x) => x.maker === (maker ? 'B' : 'A') && x.run === n + 1);
    expect(c?.lines.map((x) => x.line)).toEqual(replyLines(maker, n).map((_, i) => i + 1));
    for (const line of c!.lines) {
      if (line.kind === 'study') expect(line.result).toBeTruthy();
      if (line.verdict === 'made-up-study') expect(line.result).toBe('not-found');
      for (const found of [line, ...(line.related ?? [])].filter((x) => x.result === 'not-found')) {
        // EMMI's decision: both searches on the checked date found nothing, and the same two searches found a real study.
        expect(found.searched?.filter((s) => !s.rule.startsWith('control') && s.found === false && s.date === checks!.checked)).toHaveLength(2);
        expect(found.searched?.filter((s) => s.rule.startsWith('control') && s.doi && s.date === checks!.checked)).toHaveLength(2);
      }
    }
  }
}
test('T2 one dated check for every non-empty answer line', () => checksOkay(answers));
test('T2 known-bad: a missing line or a not-found study without its control fails', () => {
  const copy = structuredClone(answers);
  copy[10].lines.pop();
  expect(() => checksOkay(copy)).toThrow();
  const noControl = structuredClone(answers);
  const study = noControl.flatMap((a) => a.lines).find((l) => l.verdict === 'made-up-study')!;
  study.searched = study.searched!.filter((s) => !s.rule.startsWith('control'));
  expect(() => checksOkay(noControl)).toThrow();
});
// p6-15-review B1 and B2: a "does not match" line never names a detail the answer already gives as the record does, and a
// found-but-different result never says the searches did not find the study.
const norm = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const citedTitle = (text: string) => /\*\*Title:\*\*\s*\*(.+)\*\s*$/.exec(text)?.[1] ?? /\*\*"([^"]+)"\*\*/.exec(text)?.[1];
function falseChecks(all: Checks): string[] {
  return all.flatMap((a) => a.lines.flatMap((l) => {
    // A study's cited words are every line of that study in the answer; another line's are its own.
    const lines = replyLines(a.maker === 'A' ? 0 : 1, a.run - 1);
    const text = norm(l.kind === 'study' ? a.lines.filter((x) => x.kind === 'study' && x.study === l.study).map((x) => lines[x.line - 1]).join(' ') : lines[l.line - 1]);
    const where = `${a.maker}${a.run} line ${l.line}`;
    const wrong = Object.entries(l.wrong ?? {}).filter(([k, v]) => k === 'title' ? norm(citedTitle(lines[l.line - 1]) ?? '') === norm(v) : text.includes(norm(v)));
    const notes = [l, ...(l.related ?? [])].filter((x) => x.result === 'found-but-different' && /not find|could not|did not/i.test(x.note ?? ''));
    return [...wrong.map(([k]) => `${where}: the answer gives the record's ${k}`), ...notes.map(() => `${where}: found but different, yet not found`)];
  }));
}
test('T2 every wrong detail differs from what the answer cites', () => {
  expect(falseChecks(answers)).toEqual([]);
  const planted = structuredClone(answers);
  const b9 = planted.find((a) => a.maker === 'B' && a.run === 9)!;
  b9.lines[2].wrong = { ...b9.lines[2].wrong, journal: 'Computers & Education' };
  b9.lines[1].note = 'Our searches did not find this study.';
  expect(falseChecks(planted)).toEqual(['B9 line 2: found but different, yet not found', 'B9 line 3: the answer gives the record\'s journal']);
});
// p6-15-review S8: keys, auth headers (plain or as JSON keys) and account ids, over every recording and built page.
const LEAK = /sk-ant-|\bbearer\s+\S|["']?\b(?:authorization|x-api-key|api[_-]?key)["']?\s*[=:]|account[_-]?id\s*[=:]/i;
test('no recorded file or built page holds a key, auth header or account id', () => {
  const files = [...globSync('data/recorded/*.json'), ...globSync('dist/**/*.html')];
  expect(files.length).toBeGreaterThan(1);
  expect(files.filter((f) => LEAK.test(readFileSync(f, 'utf8')))).toEqual([]);
  for (const plant of ['{"authorization":"Bearer FAKE0000"}', '{"x-api-key":"FAKE0000"}', '"sk-ant-FAKE"']) expect(LEAK.test(plant), plant).toBe(true);
});
