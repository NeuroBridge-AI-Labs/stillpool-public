// 4.3's pretend detector: lesson 1.4's word-counting model of one book, turned into a rating in words. Pure. The page calls it
// at build time and ships only the words; nothing runs in the browser. A piece is "seen" if the two pieces before it and it
// occur in a row in the book (pack ai-detectors, section 1c). The first two pieces of a text have no pair before them, so they
// are not rated. No smoothing, as in 1.4: a run the book never held counts as not seen.
import { pieces } from './next-word.ts';

export interface Seen { seen: number; total: number }

const key = (a: string, b: string, c: string) => `${a} ${b} ${c}`; // a piece never holds a space

export const trigrams = (book: string): Set<string> => {
  const ps = pieces(book);
  return new Set(ps.slice(2).map((c, i) => key(ps[i], ps[i + 1], c)));
};

export const predictability = (text: string, book: Set<string>): Seen => {
  const ps = pieces(text);
  const rated = ps.slice(2);
  return { seen: rated.filter((c, i) => book.has(key(ps[i], ps[i + 1], c))).length, total: rated.length };
};

// The flag lines, fixed here (pack section 5): at least half seen is flagged, at least a quarter is flagged, less is not.
// Whole numbers, so no rounding decides a band. A text too short to have a rated piece gets no band at all.
export const rating = ({ seen, total }: Seen): string => {
  if (!total) return 'too short to rate';
  if (seen * 2 >= total) return 'very predictable, flagged';
  if (seen * 4 >= total) return 'fairly predictable, flagged';
  return 'not very predictable, not flagged';
};

export const flagged = (r: Seen) => rating(r).endsWith(', flagged');

// "N pieces in M were seen", as the page and recorded.yaml both say it. Never a percentage.
export const seenLine = ({ seen, total }: Seen) => (seen === 1 ? `1 piece in ${total} was seen` : `${seen} pieces in ${total} were seen`);
