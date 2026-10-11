// One-off, run by hand and never by the build: embeds every glossary entry and the eight R-5.5 questions with
// nomic-embed-text (Apache-2.0, checked with `ollama show nomic-embed-text`) on the Ollama server on this Mac, and writes
// data/interactive/glossary-vectors.json. Re-run it before a preview whenever a glossary changes: node scripts/glossary-vectors.ts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { load } from 'js-yaml';

const MODEL = 'nomic-embed-text';
const OUT = 'data/interactive/glossary-vectors.json';
// The questions of R-5.5 (.ops/p45/recording-specs.md), word for word. The recorder reads them back from the JSON.
const QUESTIONS = [
  'What is a token?',
  'What does temperature change in a language model?',
  'How many tag characters are there in Unicode, and what are they used for?',
  'What is the difference between a round and an epoch in training?',
  'How many tokens fit in the context window of Claude Sonnet 5?',
  "How much of a page's text does a citation show?",
  'Under the AI Act, who counts as a deployer?',
  'What is fine-tuning?',
];
// nomic-embed-text is trained with these task prefixes; the questions are the queries, the glossary entries the documents.
const QUERY = 'search_query: ';
const DOC = 'search_document: ';

const base = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
if (new URL(base).hostname !== '127.0.0.1') throw new Error(`refusing ${base}: only the loopback address 127.0.0.1 is allowed`);

const round = (n: number) => Math.round(n * 1e5) / 1e5;
const dirs = (path: string) => readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `${path}/${d.name}`).sort();
const lessons = dirs('content').flatMap(dirs);
const entries = lessons.flatMap((dir) => {
  const text = readFileSync(`${dir}/index.mdx`, 'utf8');
  const front = load(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '') as { title: string; glossary?: { term: string; meaning: string }[] };
  return (front.glossary ?? []).map(({ term, meaning }) => ({ lesson: dir.split('/')[2], title: front.title, term, meaning }));
});

const post = async (path: string, body?: object) => {
  const res = await fetch(`${base}${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};
const digest = (await post('/api/tags')).models.find((m: { name: string }) => m.name === `${MODEL}:latest`)?.digest;
if (!digest) throw new Error(`${MODEL} is not pulled`);
const { embeddings } = await post('/api/embed', {
  model: MODEL,
  input: [...entries.map((e) => `${DOC}${e.term}: ${e.meaning}`), ...QUESTIONS.map((q) => `${QUERY}${q}`)],
});
if (embeddings.length !== entries.length + QUESTIONS.length) throw new Error('wrong number of vectors');
const vec = (i: number) => (embeddings[i] as number[]).map(round);

const json = {
  model: MODEL, digest, date: new Date().toLocaleDateString('en-CA'), dimension: embeddings[0].length,
  entries: entries.map((e, i) => ({ ...e, vector: vec(i) })),
  questions: QUESTIONS.map((text, i) => ({ id: `Q${i + 1}`, text, vector: vec(entries.length + i) })),
};
writeFileSync(OUT, `${JSON.stringify(json)}\n`);
console.log(`${OUT}: ${json.entries.length} entries, ${json.questions.length} questions, dimension ${json.dimension}`);
