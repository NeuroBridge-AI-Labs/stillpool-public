// The one definition of "this page is noindex", shared by check:seo and check:lhci: a robots meta in the <head> only.
export const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag)?.[2];
export const headOf = (html: string) => /<head\b[\s\S]*?<\/head>/i.exec(html)?.[0] ?? '';
export const isNoindex = (html: string) =>
  [...headOf(html).matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => attr(tag, 'name') === 'robots' && /noindex/i.test(attr(tag, 'content') ?? ''));
