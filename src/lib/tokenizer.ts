// Lesson 1.3's tokeniser (brief, Interactive): o200k_base from gpt-tokenizer 4.0.0, bundled with the site and never
// fetched from another host. The page's box loads this file only through a dynamic import(), so it gets its own
// tokenizer.*.js chunk (check:budget); the five items and the text version call it at build time.
import bpe from 'gpt-tokenizer/bpeRanks/o200k_base';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

// A whole piece of text, or the bytes of part of a character (pack F12).
export type Piece = { id: number; text: string } | { id: number; bytes: number[] };

// One ID's own bytes, read on their own. Never decode([id]) one ID after another: decode() keeps unfinished bytes
// between calls, so it can show a whole character under an ID that holds only part of it (brief B1, pack CR9).
// A string entry is the piece's text; bytes are text only if a fresh strict decoder takes them whole (a BOM kept).
export function piece(id: number): Piece {
  const entry = bpe[id];
  if (typeof entry === 'string') return { id, text: entry };
  try {
    return { id, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new Uint8Array(entry)) };
  } catch {
    return { id, bytes: entry };
  }
}

// Throws on text the tokeniser keeps for its own use, such as <|endoftext|>; the box says so (brief).
export const split = (text: string): Piece[] => encode(text).map(piece);

const MARKS: Record<string, string> = {
  ' ': 'a space',
  '.': 'full stop',
  ',': 'comma',
  '!': 'exclamation mark',
  '?': 'question mark',
  ':': 'colon',
  ';': 'semicolon',
  "'": 'apostrophe',
  '"': 'quotation mark',
  '-': 'hyphen',
  '(': 'opening bracket',
  ')': 'closing bracket',
};
// What a screen reader hears before a piece's number (brief, "How a split is shown"), as [words, the piece's own text to
// quote, or '']: `"st"`, `space, then "AI"`, `comma`, `part of a character`, `an invisible joining character`.
// ponytail: marks outside MARKS are quoted as they are; name more when the box shows one read badly.
export function spoken(p: Piece | { text: string }): [string, string] {
  if (!('text' in p)) return ['part of a character', ''];
  if (/^\p{Cf}+$/u.test(p.text)) return [p.text === '\u200d' ? 'an invisible joining character' : 'an invisible character', ''];
  const space = p.text.length > 1 && p.text.startsWith(' ') ? 'space, then ' : '';
  const rest = space ? p.text.slice(1) : p.text;
  return MARKS[rest] ? [space + MARKS[rest], ''] : [space, rest];
}
