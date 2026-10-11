// The sticky header's real height (7d point 7). It is measured when the header changes size (larger text, a wrapped
// row), never on a timer, and written only when the number changes; scroll-padding, the lesson rail and the reading
// ruler all read it. It is written into a constructed stylesheet, which the CSP allows (ADR 0001) and which changes no
// attribute, so the page's DOM never changes by itself (check:stillness).
const bar = document.querySelector<HTMLElement>('.site-header');

if (bar) {
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  let last = '';
  new ResizeObserver(() => {
    const height = `${Math.ceil(bar.getBoundingClientRect().height)}px`;
    if (height === last) return;
    last = height;
    sheet.replaceSync(`:root { --header-h: ${height}; }`);
  }).observe(bar);
}

export const headerBottom = () => bar?.getBoundingClientRect().bottom ?? 0;

// A control that the keyboard focuses is never left under the header: a short one that would be covered is brought
// into view 24 px below it. A tall container (main, after the skip link) and a mouse click are left to the browser.
export const clearHeader = (el: Element) => {
  const { top, height } = el.getBoundingClientRect();
  const clearance = headerBottom() + 24;
  if (top < clearance && height < innerHeight / 2 && el.matches(':focus-visible') && !el.closest('dialog, .site-header, .skip')) scrollBy(0, top - clearance);
  return el.getBoundingClientRect();
};
addEventListener('focusin', (e) => e.target instanceof Element && clearHeader(e.target));
