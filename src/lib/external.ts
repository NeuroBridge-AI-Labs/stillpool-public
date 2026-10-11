// Every link to another website opens in a new tab, says so in words (WCAG G201) and shows a small icon. One place, on the
// finished HTML of every page, so a lesson, a component or a page written later gets it too. checks/links.ts holds the built
// site to it. ponytail: a regex over Astro HTML; anchors never nest, and quoted attribute values may contain >.
// The warning is clipped, and global.css draws the Phosphor icon from one local mask asset. Repeating its SVG path
// in HTML made the citation-heavy page fail Lighthouse (213 copies, 78 KB). Neither decoration enters narration,
// and data-pagefind-ignore keeps the warning words out of the search index and its excerpts.
const WARNING = '<span class="new-tab" data-pagefind-ignore> (opens in a new tab)</span>';

export const markExternal = (html: string, site: string) =>
  html.replace(/<a\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a>/gi, (whole, attrs: string, body: string) => {
    const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!href) return whole;
    const url = new URL(href[1] ?? href[2] ?? href[3], site);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === new URL(site).origin) return whole;
    return `<a${attrs.replace(/\s(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')} target="_blank" rel="noopener noreferrer">${body}${WARNING}</a>`;
  });
