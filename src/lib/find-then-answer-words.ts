// Lesson 5.5: the words the page says about a question's first match. Pure; the page calls it at build.
import { cosine, inWords, type Entry, type Match } from './find-then-answer.ts';

// What each of the eight questions (data/interactive/glossary-vectors.json, Q1 to Q8) asks about. The snapshot has no
// entry for the last one. Question 4 names two terms, and either one's entry counts.
export const ABOUT: (string | string[])[] = ['token', 'temperature', 'tag character', ['round', 'epoch'], 'context window', 'citation', 'deployer', 'fine-tuning'];

// The store is a fixed snapshot of the glossary, not the glossary as it is now. The counts come from the file, so the
// page cannot name different ones; src/lib/find-then-answer-words.test.ts pins the lesson's own words to them.
export const snapshot = (entries: Entry[]) => `${entries.length} entries from the first ${new Set(entries.map((e) => e.lesson)).size} lessons`;

// "Our reading" of the second prediction: is the first match the entry for the thing the question asks about? Worked
// out from the vectors, so it follows the glossary whenever the lists are made again.
export const firstMatch = (question: number[], entries: Entry[], about: string | string[], first: Match) => {
  const names = [about].flat();
  if (names.includes(first.term)) return `Yes. The first match is the entry for ${first.term}.`;
  const ranked = entries.map(({ term, vector }) => ({ term, similarity: cosine(question, vector) })).sort((a, b) => b.similarity - a.similarity);
  const place = ranked.findIndex((e) => names.includes(e.term));
  if (place < 0) return `No. The snapshot of the glossary has no entry for ${names.join(' or ')}. The first match is ${first.term}: ${inWords(first.similarity)}.`;
  return `No. The first match is ${first.term}. The entry for ${ranked[place].term} is number ${place + 1} in the full ranking: ${inWords(ranked[place].similarity)}.`;
};
