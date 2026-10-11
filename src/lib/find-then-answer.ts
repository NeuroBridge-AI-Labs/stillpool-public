// Lesson 5.5 "Find, then answer": rank glossary entries by how close their vectors are to a question's vector.
// Pure: the vectors are computed once by scripts/glossary-vectors.ts, never here and never in the browser.
export type Entry = { term: string; lesson: string; vector: number[] };
export type Match = { term: string; lesson: string; similarity: number };

// Chosen by looking at the real cosines of the eight R-5.5 questions (data/interactive/glossary-vectors.json):
// an entry whose term is the question's subject scored 0.64 to 0.88 ("temperature" for Q2 is the low end, at 0.64); entries on the same topic scored 0.65 to 0.76;
// "What is fine-tuning?" (no entry exists) never went above 0.55, and most unrelated entries sat below 0.65.
export const VERY_CLOSE = 0.8;
export const CLOSE = 0.65;
export const TOP = 5;

export const cosine = (a: number[], b: number[]) => {
  const [dot, na, nb] = a.reduce(([d, x, y], v, i) => [d + v * b[i], x + v * v, y + b[i] * b[i]], [0, 0, 0]);
  return dot / Math.sqrt(na * nb);
};

// Array.sort is stable, so equal similarities keep the order of `entries`.
export const rank = (question: number[], entries: Entry[]): Match[] =>
  entries
    .map(({ term, lesson, vector }) => ({ term, lesson, similarity: cosine(question, vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP);

export const inWords = (similarity: number) => (similarity >= VERY_CLOSE ? 'very close' : similarity >= CLOSE ? 'close' : 'not close');
