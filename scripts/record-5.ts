import { readFileSync } from 'node:fs';
import { rank } from '../src/lib/find-then-answer.ts';
import { type Variant, v } from './record-2.ts';

// The Pillar 5 recording set, R-5.1 (.ops/p45/recording-specs.md, version A): the same line sent raw to a local base model
// and, through its chat template, to its tuned version. No key, no API: record.ts reads two 127.0.0.1 llama-server addresses.
export const SETS_5 = {
  'R-5.1': { message: 'What is the capital of Ireland?', runs: 3, max_tokens: 80, temperature: 0.7 },
};

// R-5.5 (recording-specs.md, swap rule applied): each question is sent with the engine's own top three entries, in rank order,
// built from data/interactive/glossary-vectors.json. The questions live in that file (scripts/glossary-vectors.ts writes them).
export const SYSTEM_55 =
  "Answer the question using only the passages. After each sentence of your answer, give the number of the passage it comes from in square brackets, like [2]. Quote the passage's own words in double quotation marks at least once. If the passages do not answer the question, say so, and do not answer from anything else.";
type Vectors = { entries: { lesson: string; title: string; term: string; meaning: string; vector: number[] }[]; questions: { id: string; text: string; vector: number[] }[] };
const vectors: Vectors = JSON.parse(readFileSync(new URL('../data/interactive/glossary-vectors.json', import.meta.url), 'utf8'));
export const passages = (vector: number[]) =>
  rank(vector, vectors.entries).slice(0, 3).map(({ term, lesson }) => vectors.entries.find((e) => e.term === term && e.lesson === lesson)!);
const prompt = ({ text, vector }: Vectors['questions'][number]) =>
  `Passages:\n${passages(vector).map((e, i) => `[${i + 1}] ${e.term} (from the lesson "${e.title}"): ${e.meaning}`).join('\n')}\n\nQuestion: ${text}`;

export const SETS_55 = { 'R-5.5': vectors.questions.map((q) => v(q.id, prompt(q), 1, SYSTEM_55)) } satisfies Record<string, Variant[]>;
