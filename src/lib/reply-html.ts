// Astro's installed Markdown parser supplies the tree. Only these fixed tags are emitted: reply HTML is text,
// links are words, and emphasis stays upright under the site's no-italics rule. Nothing is rendered by client code.
import { markdownToMdast, type MdastNode } from 'satteri';
import { cut } from './p2-runs.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const words = (node: MdastNode): string => 'value' in node ? node.value : 'children' in node ? node.children.map(words).join('') : '';

// The reply's top-level blocks, each one whole HTML block (a paragraph, a list, a table), so a long reply can be cut
// between two of them. A table is a named region; tableName gives the name of the i-th table (from 1) of this reply.
export function replyBlocks(reply: string, falseTexts: (string | undefined)[] = [], tableName: (i: number) => string = () => 'Recorded comparison table'): string[] {
  let offset = 0;
  let tables = 0;
  const ranges = cut(reply, falseTexts).flatMap(([piece, mark]) => {
    const start = offset; offset += piece.length;
    return mark ? [[start, offset]] : [];
  });
  const text = (node: MdastNode, value: string, base: number) => {
    const start = base + (node.position?.start.offset ?? 0);
    const raw = reply.slice(start, base + (node.position?.end.offset ?? 0));
    // Code delimiters are not spoken or highlighted. Text escapes and entities are decoded by the same parser.
    const inset = node.type === 'inlineCode' || node.type === 'code' ? Math.max(0, raw.indexOf(value)) : 0;
    const at = (n: number) => {
      const end = Math.max(0, Math.min(raw.length, n - start - inset));
      return raw.slice(inset, inset + value.length) === value ? Math.min(value.length, end) : words(markdownToMdast('\uE000' + raw.slice(inset, inset + end) + '\uE000')).slice(1, -1).length;
    };
    let end = 0;
    const out: string[] = [];
    for (const [a, b] of ranges) {
      if (b <= start || a >= (base + (node.position?.end.offset ?? 0))) continue;
      const [left, right] = [at(a), at(b)];
      if (right <= left) continue;
      out.push(esc(value.slice(end, left)), `<mark>${esc(value.slice(left, right))}</mark>`);
      end = right;
    }
    return out.join('') + esc(value.slice(end));
  };
  const render = (node: MdastNode, tight = false, base = 0): string => {
    // A model sometimes continues numbering after a label without a blank line. CommonMark treats that as prose.
    // Reparse only that paragraph's two blocks; original offsets keep every fact-check highlight aligned.
    if (node.type === 'paragraph') {
      const start = base + (node.position?.start.offset ?? 0);
      const raw = reply.slice(start, base + (node.position?.end.offset ?? 0));
      // Only after a label (a line ending in a colon or closing emphasis), so a year at a line start stays a paragraph.
      const split = raw.search(/(?<=[:*][ \t]*)\n(?=\d+[.)] )/);
      if (split >= 0) return render(markdownToMdast(raw.slice(0, split)), tight, start) + render(markdownToMdast(raw.slice(split + 1)), tight, start + split + 1);
    }
    const body = 'children' in node ? node.children.map((child) => render(child, node.type === 'list' ? !node.spread : tight, base)).join('') : '';
    switch (node.type) {
      case 'root': case 'emphasis': case 'link': case 'linkReference': return body;
      case 'paragraph': return tight ? body : `<p>${body}</p>`;
      case 'heading': { const level = node.depth < 4 ? 5 : 6; return `<h${level}>${body}</h${level}>`; }
      case 'strong': return `<strong>${body}</strong>`;
      case 'blockquote': return `<blockquote>${body}</blockquote>`;
      case 'list': { const tag = node.ordered ? 'ol' : 'ul'; return `<${tag}${node.ordered && node.start && node.start !== 1 ? ` start="${node.start}"` : ''}>${body}</${tag}>`; }
      case 'table': {
        const head = render(node.children[0], false, base).replace(/<(\/?)td>/g, '<$1th>');
        return `<div class="table-scroll" role="region" aria-label="${esc(tableName(++tables))}" tabindex="0"><table><thead>${head}</thead><tbody>${node.children.slice(1).map((row) => render(row, false, base)).join('')}</tbody></table></div>`;
      }
      case 'tableRow': return `<tr>${body}</tr>`;
      case 'tableCell': return `<td>${body}</td>`;
      case 'listItem': return `<li>${body}</li>`;
      case 'thematicBreak': return '<hr>';
      case 'break': return '<br>';
      case 'inlineCode': return `<code>${text(node, node.value, base)}</code>`;
      case 'code': return `<pre><code>${text(node, node.value, base)}</code></pre>`;
      case 'text': return text(node, node.value, base).replace(/\n/g, '<br>');
      case 'html': return text(node, node.value, base);
      case 'image': case 'imageReference': return esc(node.alt ?? '');
      case 'definition': return '';
      default: return body || esc(words(node));
    }
  };
  const root = markdownToMdast(reply, { features: { gfm: { footnotes: false } } });
  const blocks = 'children' in root ? root.children.map((block) => render(block)) : [];
  // Guard: the highlighted text must be exactly the marked pieces, or a mark has drifted (offsets differ from the parsed text).
  const same = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/[\s*_`#>|~-]/g, '');
  const got = same([...blocks.join('').matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => m[1]).join(''));
  const want = same(cut(reply, falseTexts).filter(([, mark]) => mark).map(([piece]) => words(markdownToMdast(piece))).join(''));
  if (got !== want) throw new Error(`replyHtml: marks drifted in the reply starting "${reply.slice(0, 60)}": marked "${got}", expected "${want}"`);
  return blocks;
}

export const replyHtml = (reply: string, falseTexts: (string | undefined)[] = []) => replyBlocks(reply, falseTexts).join('');

const LONG = 1500; // a reply longer than this shows an excerpt first
const EXCERPT = 500; // and the excerpt is at least this much text
const text = (html: string) => html.replace(/<[^>]+>/g, '');
// A long reply as [excerpt, rest]: the excerpt ends between two whole blocks, never on a heading, a rule or a line that
// introduces what follows, and it always holds every part marked as not true, so a mark and its reason are seen together.
export function replyParts(reply: string, falseTexts: (string | undefined)[] = [], tableName?: (i: number) => string): [string, string] {
  const blocks = replyBlocks(reply, falseTexts, tableName);
  if (reply.length <= LONG) return [blocks.join(''), ''];
  let seen = 0;
  let cut = blocks.findIndex((block) => (seen += text(block).length) >= EXCERPT) + 1;
  while (cut > 1 && (/^<(h\d|hr)/.test(blocks[cut - 1]) || text(blocks[cut - 1]).trimEnd().endsWith(':'))) cut--;
  cut = Math.max(cut, blocks.findLastIndex((block) => block.includes('<mark>')) + 1);
  return cut < 1 || cut >= blocks.length ? [blocks.join(''), ''] : [blocks.slice(0, cut).join(''), blocks.slice(cut).join('')];
}

// HTML lets these end tags go when the next tag or the parent's end shows where the element stops (a p before a list, a
// li before the next li, a td before the next td). A page holds dozens of long recorded replies, so every tag we do not
// send is a byte less in the budget; the parsed page is the same. Text never holds a "<": reply text is escaped.
export const compact = (html: string) => html.replace(/<\/(?:p|li|td|th|tr|thead|tbody)>/g, '');
