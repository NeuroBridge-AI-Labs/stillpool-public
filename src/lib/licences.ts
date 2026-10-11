// public/licences.txt is the one source of the credits: the text file is served as it is, and /licences/ renders the same
// text, so the two cannot drift. Blocks are separated by blank lines; a "- " line starts a list item and indented lines
// continue it.
export type Block = { text: string; items: string[] };
export type Piece = { text: string; href?: string };

export const blocks = (source: string): Block[] =>
  source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n');
      const first = lines.findIndex((line) => line.startsWith('- '));
      const head = first < 0 ? lines : lines.slice(0, first);
      const items = first < 0 ? [] : lines.slice(first).join('\n').split(/\n(?=- )/);
      return { text: head.join(' ').trim(), items: items.map((item) => item.slice(2).replace(/\s*\n\s*/g, ' ')) };
    });

// Web addresses become links; a full stop, comma, colon or closing bracket after one is not part of it.
export const pieces = (text: string): Piece[] =>
  text.split(/(https?:\/\/[^\s]+?)(?=[.,:;)]*(?:\s|$))/).map((part, i) => (i % 2 ? { text: part, href: part } : { text: part }));
