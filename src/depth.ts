// Reading depth (plan T6.2, D5, Q11). The global choice is html[data-depth], which boot.js sets from ?depth= or
// nbl:settings before the first paint. A global flip stores it, writes ?depth= and clears the section flips. A section
// flip marks that section's Deep layers with data-flip and is not stored. src/styles/settings.css shows and hides.
const SETTINGS = 'nbl:settings';
const root = document.documentElement;
const groups = [...document.querySelectorAll('.depth')];
const press = (group: Element, chosen: string) => {
  for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.depth === chosen));
};
const pressAll = () => groups.forEach((g) => press(g, root.dataset.depth === 'deep' ? 'deep' : 'simple'));
// A section's layers: the siblings after its group, up to the next heading or the activity (ends where visible() in src/readaloud.ts ends).
const layersAfter = (group: Element) => {
  const found: HTMLElement[] = [];
  for (let el = group.nextElementSibling; el && el.tagName !== 'H2' && !el.matches('[data-part]'); el = el.nextElementSibling)
    if (el instanceof HTMLElement && el.dataset.layer) found.push(el);
  return found;
};

pressAll();
addEventListener('click', (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>('.depth button');
  const group = button?.parentElement;
  if (!button || !group) return;
  const chosen = button.dataset.depth === 'deep' ? 'deep' : 'simple';
  if (group.hasAttribute('data-section')) {
    // Simple always shows; only the Deep layer is flipped.
    for (const layer of layersAfter(group)) if (layer.dataset.layer === 'deep') layer.dataset.flip = chosen === 'deep' ? 'show' : 'hide';
    return press(group, chosen);
  }
  // Simple is the default, so it is removed rather than stored, as src/settings.ts does.
  if (chosen === 'deep') root.dataset.depth = chosen;
  else delete root.dataset.depth;
  for (const layer of document.querySelectorAll<HTMLElement>('[data-flip]')) delete layer.dataset.flip;
  pressAll();
  const url = new URL(location.href);
  url.searchParams.set('depth', chosen);
  history.replaceState(history.state, '', url);
  try {
    const { depth: _, ...rest } = JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') ?? {};
    localStorage.setItem(SETTINGS, JSON.stringify(chosen === 'deep' ? { ...rest, depth: chosen } : rest));
  } catch {
    // no storage, or a value that is not JSON: this page still flips
  }
});
