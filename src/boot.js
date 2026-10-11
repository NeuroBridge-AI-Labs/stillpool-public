(() => {
  const html = document.documentElement;
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem('nbl:settings')) || {};
  } catch {
  }
  for (const [k, v] of Object.entries(s)) if (/^[a-z]+$/.test(k) && /^[\w.-]+$/.test(v)) html.setAttribute(`data-${k}`, v);
  const depth = new URLSearchParams(location.search).get('depth');
  if (depth === 'simple' || depth === 'deep') html.dataset.depth = depth;
  if (!['light', 'dark', 'contrast'].includes(s.theme)) {
    const device = (query) => matchMedia(query).matches;
    html.dataset.theme = device('(prefers-contrast: more)') ? 'contrast' : device('(prefers-color-scheme: dark)') ? 'dark' : 'light';
  }
  html.dataset.js = '';
})();
