// Pillar 2's activities (stage I) read recorded answers, never a model. This file loads one recording with the words a
// person wrote about it (recorded.yaml), and answers the questions every Pillar 2 activity asks of it: which variant,
// which run, what was sent, what was marked. The e2e fixture build reads fixtures/recorded; the site never does.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { recorded, recording, shownSetting } from '../lesson-schema.ts';

export type Rec = ReturnType<typeof recording.parse>;
export type Said = ReturnType<typeof recorded.parse>[string];
export type Variant = Rec['variants'][number];
export type Run = Variant['runs'][number];

export const reading = (run: Run) => run.replies ?? [run.reply];
// A run's turns: each message sent, with the reply to it.
export function turns(v: Variant, run: Run) {
  const replies = reading(run);
  if (replies.length !== (v.messages?.length ?? 1)) throw new Error(`${v.label}: ${replies.length} replies for ${v.messages?.length} messages`);
  return replies.map((reply, i) => ({ sent: v.messages![i].content, reply }));
}

export const variantOf = (rec: Rec, label: string, maker: 'A' | 'B') => {
  const v = rec.variants.find((x) => x.label === label && x.maker === maker);
  if (!v) throw new Error(`${rec.id}: no variant ${label} from maker ${maker}`);
  return v;
};
export const labelsOf = (rec: Rec) => [...new Set(rec.variants.map((v) => v.label!))];
export const modelOf = (rec: Rec, v: Variant) => v.model ?? rec.model;
// Every mark on one run: a run can carry several.
export const marksOf = (said: Said, label: string, maker: 'A' | 'B', run: number) =>
  (said.marks ?? []).filter((m) => m.variant === label && m.maker === maker && m.run === run);
export const paragraphs = (said: Said) => said.summary.trim().split(/\n\s*\n/);
export const day = (rec: Rec) => new Date(rec.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// A reply cut into [text, marked] pieces around every piece a person marked as not true, in reading order.
export function cut(text: string, falseTexts: (string | undefined)[] = []): [string, boolean][] {
  const hits = falseTexts.flatMap((f) => (f && text.includes(f) ? [{ at: text.indexOf(f), f }] : [])).sort((x, y) => x.at - y.at);
  const out: [string, boolean][] = [];
  let end = 0;
  for (const { at, f } of hits) {
    if (at < end) continue; // overlaps a piece already marked
    out.push([text.slice(end, at), false], [f, true]);
    end = at + f.length;
  }
  out.push([text.slice(end), false]);
  return out.filter(([piece]) => piece);
}

const NAMES: Record<string, string> = {
  max_tokens: 'Longest answer, in tokens', temperature: 'Temperature', default_model_temperature: "The model's default temperature, read from its model list",
  tools: 'Tools', 'system prompt': 'Instructions from us behind the message', model: 'Model name sent',
};
// Every stored setting of a maker's variants, as [name, words]. The file's one "system prompt" line says "in each variant
// that has one", so it is replaced by what was recorded: the instruction itself, or that there was none.
export function settingRows(rec: Rec, variants: Variant[]): [string, string][] {
  const systems = variants.filter((v) => v.system);
  const sys = !systems.length ? 'none' : systems.length === variants.length ? `"${systems[0].system}"` : 'none, except where a run shows one';
  return Object.entries(variants[0].settings ?? rec.settings).map(([k, v]) => [NAMES[k] ?? k, k === 'system prompt' ? sys : shownSetting(v)]);
}

// A mark must point at a run that exists, and the text it calls not true must be in that run.
function checkMarks(rec: Rec, said: Said) {
  for (const m of said.marks ?? []) {
    const run = variantOf(rec, m.variant, m.maker).runs[m.run - 1];
    if (!run) throw new Error(`${rec.id}: mark on ${m.variant} ${m.maker} run ${m.run}, which was not recorded`);
    if (m.falseText && !reading(run).some((r) => r.includes(m.falseText!))) throw new Error(`${rec.id}: falseText of ${m.variant} ${m.maker} run ${m.run} is not in the run`);
  }
}
export function loadRecorded(id: string, lesson: string, pillar = 'prompting') {
  const fixture = process.env.RECORDED_FIXTURE === '1';
  const rec = recording.parse(JSON.parse(readFileSync(`${fixture ? 'fixtures' : 'data'}/recorded/${id}.json`, 'utf8')));
  const file = fixture ? 'fixtures/recorded/recorded.yaml' : `content/${pillar}/${lesson}/recorded.yaml`;
  const said = recorded.parse(load(readFileSync(file, 'utf8')))[id];
  if (!said) throw new Error(`${file}: no entry for ${id}`);
  checkMarks(rec, said);
  return { rec, said };
}
