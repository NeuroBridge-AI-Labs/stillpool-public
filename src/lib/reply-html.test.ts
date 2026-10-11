import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compact, replyHtml, replyParts } from './reply-html.ts';

describe('replyHtml', () => {
  it('turns bold, headings, rules, quotes, lists and code into HTML', () => {
    const html = replyHtml('**Subject:** Hi\n\n### **Tips:**\n\n---\n\n> *"Quoted"*\n\n1. one\n2. two\n\n- a\n- b\n\nuse `x < y`');
    expect(html).toContain('<p><strong>Subject:</strong> Hi</p>');
    expect(html).toContain('<h5><strong>Tips:</strong></h5>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<blockquote><p>&quot;Quoted&quot;</p></blockquote>');
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<code>x &lt; y</code>');
    expect(html).not.toMatch(/\*|###|<(?:e[m]|i)>/);
  });
  it('keeps nested lists, reference links and marks at block boundaries', () => {
    expect(replyHtml('- outer\n  - inner')).toContain('<ul><li>outer<ul><li>inner</li></ul></li></ul>');
    expect(replyHtml('[source][s]\n\n[s]: https://example.com')).toBe('<p>source</p>');
    expect(replyHtml('## **Claim**\n\nNext', ['## **Claim**\n\nNext'])).toBe('<h5><strong><mark>Claim</mark></strong></h5><p><mark>Next</mark></p>');
  });
  it('keeps marks aligned after Unicode, escapes and entities', () => {
    expect(replyHtml('😀 **claim**', ['claim'])).toBe('<p>😀 <strong><mark>claim</mark></strong></p>');
    expect(replyHtml('A &amp; B claim', ['claim'])).toBe('<p>A &amp; B <mark>claim</mark></p>');
    expect(replyHtml('A &amp; B', ['&amp;'])).toBe('<p>A <mark>&amp;</mark> B</p>');
    expect(replyHtml('use `bad claim`', ['bad claim'])).toContain('<code><mark>bad claim</mark></code>');
  });
  it('formats a continued numbered list after a label, without changing code', () => {
    expect(replyHtml('**Preferences**\n4. energy\n5. style')).toBe('<p><strong>Preferences</strong></p><ol start="4"><li>energy</li><li>style</li></ol>');
    expect(replyHtml('Label:\n4. **claim**',['4. **claim**'])).toContain('<li><strong><mark>claim</mark></strong></li>');
    expect(replyHtml('```\nLabel\n4. literal\n```')).toContain('<code>Label\n4. literal</code>');
  });
  it('renders the recorded comparison tables as real cells', () => {
    const html = replyHtml('| Method | Pros |\n|---|---|\n| **Recall** | claim |', ['claim']);
    expect(html).toContain('<thead><tr><th>Method</th><th>Pros</th></tr></thead>');
    expect(html).toContain('<td><strong>Recall</strong></td><td><mark>claim</mark></td>');
    expect(html).not.toContain('|');
  });
  it('shows raw HTML as text and never makes a link', () => {
    const html = replyHtml('<script>run()</script> <img src=x onerror=y> [click](https://e.com) https://e.com');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a');
    expect(html).toContain('&lt;script&gt;run()&lt;/script&gt;');
    expect(html).toContain('click');
  });
  it('highlights a marked piece, also when it spans formatting', () => {
    expect(replyHtml('It was **built in 1999** by a team', ['built in 1999'])).toBe('<p>It was <strong><mark>built in 1999</mark></strong> by a team</p>');
    expect(replyHtml('A **bold claim** here', ['bold claim** here'])).toBe('<p>A <strong><mark>bold claim</mark></strong><mark> here</mark></p>');
    const across = replyHtml('One **two** three\n\n- four', ['two** three\n\n- four']);
    expect(across).toContain('<ul><li><mark>four</mark></li></ul>');
    expect(across).not.toMatch(/<mark>\s*<\/mark>/);
    expect(across.match(/<mark>/g)?.length).toBe(across.match(/<\/mark>/g)?.length);
    expect(replyHtml('plain claim', ['claim'])).toBe('<p>plain <mark>claim</mark></p>');
  });
  it('throws instead of highlighting the wrong text when a mark would drift', () => {
    expect(() => replyHtml('> a\n> b claim', ['claim'])).toThrow(/marks drifted in the reply starting "> a/);
  });
  it('keeps a year at a line start in its paragraph, and a numbered list after a label stays a list', () => {
    expect(replyHtml('It was founded in\n1999. It grew fast.')).toBe('<p>It was founded in<br>1999. It grew fast.</p>');
    expect(replyHtml('**Format**\n7. Do you want')).toBe('<p><strong>Format</strong></p><ol start="7"><li>Do you want</li></ol>');
    expect(replyHtml('A fourth study:)*\n4. x')).toContain('<ol start="4">');
  });
  it('still builds every real recording, and every label-then-number line in them is a list', () => {
    const replies: string[] = [];
    const walk = (v: unknown, key = '') => {
      if (typeof v === 'string') { if (key === 'reply' || key === 'replies') replies.push(v); }
      else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    for (const f of readdirSync('data/recorded')) walk(JSON.parse(readFileSync(`data/recorded/${f}`, 'utf8')));
    const labelled = replies.filter((r) => /[:*][ \t]*\n[2-9]\d*[.)] /.test(r));
    expect(replies.length).toBeGreaterThan(50);
    expect(labelled.length).toBeGreaterThan(3);
    for (const r of replies) replyHtml(r);
    for (const r of labelled) expect(replyHtml(r)).toMatch(/<ol(?: start="\d+")?>/);
    for (const r of replies) expect(replyHtml(r)).not.toMatch(/<ol start="\d{3,}"/);
  });
});

describe('replyParts', () => {
  const para = (n: number) => `Paragraph ${n} ${'word '.repeat(60)}`.trim();
  const long = [para(1), '### Tips:', para(2), 'Here is a list:', '- one\n- two', para(3), para(4), para(5), para(6)].join('\n\n');
  it('keeps a short reply whole', () => {
    expect(replyParts('A short reply.')).toEqual(['<p>A short reply.</p>', '']);
  });
  it('cuts a long reply between whole blocks, and the two halves are the reply', () => {
    const [head, rest] = replyParts(long);
    expect(rest).not.toBe('');
    expect(head + rest).toBe(replyHtml(long));
    expect(head.endsWith('</p>') || head.endsWith('</ul>')).toBe(true);
  });
  it('never ends the excerpt on a heading, a rule or a line that introduces what follows', () => {
    const [head] = replyParts([para(1), '### Tips:', para(2), 'Here is a list:', '- one', para(3), para(4), para(5), para(6)].join('\n\n'));
    expect(head).not.toMatch(/<h\d>[^<]*(?:<[^>]+>[^<]*)*<\/h\d>$|<hr>$|:<\/p>$/);
  });
  it('holds every part marked as not true in the excerpt', () => {
    const claim = 'a claim late in the reply';
    const text = [para(1), para(2), para(3), para(4), para(5), `Late ${claim}.`, para(6), para(7)].join('\n\n');
    const [head, rest] = replyParts(text, [claim]);
    expect(head).toContain(`<mark>${claim}</mark>`);
    expect(rest).not.toContain('<mark>');
  });
});

describe('compact', () => {
  it('drops only the end tags HTML lets go, and nothing a reader sees', () => {
    const html = replyHtml('Intro\n\n- a\n  - b\n- c\n\n| H | I |\n|---|---|\n| x | y |\n\nEnd');
    const short = compact(html);
    expect(short).not.toMatch(/<\/(?:p|li|td|th|tr|thead|tbody)>/);
    expect(short).toContain('</ul>');
    expect(short).toContain('</table>');
    expect(short.replace(/<[^>]+>/g, '')).toBe(html.replace(/<[^>]+>/g, ''));
    expect(compact('<p>use <code>x &lt; y</code></p>')).toBe('<p>use <code>x &lt; y</code>');
  });
});
