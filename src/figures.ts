// Every figure a lesson shows sits inside a phrase that is verbatim in its pack, so none is typed by hand alone
// (p6-5-review S1). A lesson pointer is a signed lesson number. Used by each text lesson's own test.
// ponytail: a phrase match, not a parser; the fact-check (L5) still reads what each phrase means.
import { load } from 'js-yaml';

const flat = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What a learner reads: the body and every frontmatter string but addresses, ids, licences, minutes, provenance and inputs.
const shown = (mdx: string) => {
  const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(mdx) ?? ['', '', mdx];
  const skip = new Set(['url', 'competencies', 'misconceptions', 'minutes', 'provenance', 'earnedBy', 'licence', 'inputs']);
  const walk = (x: unknown): string[] =>
    typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(walk) : x && typeof x === 'object' ? Object.entries(x).flatMap(([k, v]) => (skip.has(k) ? [] : walk(v))) : [];
  return flat([...walk(load(front)), body].join('\n').replace(/https?:\/\/\S+/g, ' '));
};

// Every figure, digits or words ("one", "once" and "twice" left out: each is rarely a figure), left once the pinned phrases and the lesson pointers are taken out.
export const unbound = (mdx: string, pack: string, lessons: string[], phrases: string[]) => {
  const packText = flat(pack);
  const found = phrases.filter((p) => !packText.includes(flat(p))).map((p) => `not in the pack: ${p}`);
  let text = shown(mdx).replace(/\blesson (\d+\.\d+)\b/g, (m, n: string) => (lessons.includes(n) ? ' ' : m));
  for (const p of [...phrases].sort((a, b) => b.length - a.length)) text = text.replace(new RegExp(escape(flat(p)), 'g'), ' ');
  return [...found, ...[...text.matchAll(/\S*\d\S*|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|third|fourth|fifth|quarter)\b/g)].map(([m]) => `unbound: ${m}`)];
};
