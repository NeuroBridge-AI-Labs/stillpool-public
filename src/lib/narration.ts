// Accessibility decoration belongs to a link's name, not to lesson narration. Keep innerText's rendered spacing.
// Used by device speech and, serialised into Playwright, the recording generator and stale checker.
export function narrationText(el: HTMLElement): string {
  const decoration = [...el.querySelectorAll('.new-tab, svg.ext')].map((node) => ({ node, parent: node.parentNode!, next: node.nextSibling }));
  try {
    decoration.forEach(({ node }) => node.remove());
    return el.innerText;
  } finally {
    // Restore backwards so a decoration's next sibling is already back. No paint or asynchronous work occurs here.
    for (const { node, parent, next } of decoration.reverse()) parent.insertBefore(node, next);
  }
}
