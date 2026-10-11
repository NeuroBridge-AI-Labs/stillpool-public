// check:readability. The <Simple> text of every .mdx under <target>, its In short, check-in, glossary and Where next, and each summary in a
// recorded.yaml (p6 D4), reads at Flesch-Kincaid grade 7 or below, with no sentence over 20 words and no paragraph over
// 50. <Deep> text is ignored.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

const NAME = 'readability';
const MAX_GRADE = 7;
const MAX_WORDS = 20;
const MAX_PARA = 50;

// ponytail: suffix-strip syllable heuristic, about one word in ten is off by one syllable;
// swap in a syllable-counting package only if a real lesson sits at the grade-7 boundary.
const syl = (w: string) => {
  const s = w
    .toLowerCase()
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');
  return Math.max(1, s.match(/[aeiouy]{1,2}/g)?.length ?? 0);
};
const seg = (t: string, g: 'sentence' | 'word') => [...new Intl.Segmenter('en', { granularity: g }).segment(t)];

// The In short, check-in, glossary and Where next render outside both layers, so a Simple reader gets them (R2-N3): each
// string is a Simple block. An In short or Where next sentence is its own block: the 20-word sentence rule holds, and a
// Where next may run past 50 words, since it carries a site's privacy notes (1.4's is 67).
// A double-quoted span over 20 words, the one a split cannot shorten, is read as the one word "quote" with its closing
// mark kept. A shorter quote is read in full with its framing, and odd quote marks exempt nothing. Our own words over 20
// inside quote marks still pass: the L5 fact-check is what proves a quote is a source's.
type Front = {
  tldr?: string[];
  checkin?: { question: string; options: { text: string; why: string }[] }[];
  glossary?: { meaning: string }[];
  whereNext?: { text: string };
};
const sentences = (s: string) => seg(s, 'sentence').map((x) => x.segment);
const front = (raw: string) => {
  const fm = (load(/^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? '') ?? {}) as Front;
  return [
    ...(fm.tldr ?? []).flatMap(sentences),
    ...(fm.checkin ?? []).flatMap((q) => [q.question, ...q.options.flatMap((o) => [o.text, o.why])]),
    ...(fm.glossary ?? []).map((g) => g.meaning),
    ...(fm.whereNext ? sentences(fm.whereNext.text) : []),
  ]
    .map((s) => `\n<Simple>${s.split('"').length % 2 ? s.replace(/"([^"]*?)([.?!]?)"/g, (m, q, p) => (seg(q, 'word').filter((x) => x.isWordLike).length > MAX_WORDS ? `quote${p}` : m)) : s}</Simple>`)
    .join('');
};

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['content']) {
  const files = globSync('**/{*.mdx,recorded.yaml}', { cwd: target }).sort();
  if (!files.length) findings.push(`${NAME}: nothing to check in ${target}`);
  for (const file of files) {
    const raw = readFileSync(join(target, file), 'utf8');
    const text = file.endsWith('.yaml') ? Object.values(load(raw) ?? {}).flatMap((r) => {
      const entry = r as { summary?: string; answers?: { lines?: { note?: string; related?: { note?: string }[] }[] }[] } | null;
      const notes = (entry?.answers ?? []).flatMap((a) => (a.lines ?? []).flatMap((l) => [l.note, ...(l.related ?? []).map((x) => x.note)]));
      return [entry?.summary, ...notes].filter((s): s is string => !!s && s !== 'by rule');
    }).map((s) => `<Simple>${s}</Simple>`).join('\n') : raw + front(raw);
    // Tags, link URLs and Markdown marks stripped; paragraphs and list items are separate blocks.
    const blocks = [...text.matchAll(/<Simple>([\s\S]*?)<\/Simple>/g)].flatMap(([, t]) =>
      t
        .replace(/<[^>]*>/g, ' ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`+|^#{1,6}\s+|^>\s?|[*_]{1,3}/gm, '')
        .split(/\n\s*\n|\n\s*(?:[-*+]|\d+\.)\s+/),
    );
    let [words, sentences, syllables, longest, longestPara] = [0, 0, 0, 0, 0];
    for (const block of blocks) {
      let paraWords = 0;
      for (const { segment } of seg(block.replace(/\s+/g, ' ').trim(), 'sentence')) {
        const w = seg(segment, 'word').filter((x) => x.isWordLike);
        if (!w.length) continue;
        sentences += 1;
        words += w.length;
        paraWords += w.length;
        longest = Math.max(longest, w.length);
        syllables += w.reduce((n, x) => n + syl(x.segment), 0);
      }
      longestPara = Math.max(longestPara, paraWords);
    }
    if (!words) continue;
    const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    if (grade > MAX_GRADE)
      findings.push(`${NAME}: ${file}: Simple layer Flesch-Kincaid grade ${grade.toFixed(1)} > ${MAX_GRADE} (a proxy; M2 still reads it)`);
    if (longest > MAX_WORDS) findings.push(`${NAME}: ${file}: Simple sentence of ${longest} words > ${MAX_WORDS}`);
    if (longestPara > MAX_PARA) findings.push(`${NAME}: ${file}: Simple paragraph of ${longestPara} words > ${MAX_PARA}`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
