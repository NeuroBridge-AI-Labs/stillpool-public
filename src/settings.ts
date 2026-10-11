// The Settings dialog's script (plan T4.2, D2). A change is stored in nbl:settings and set on <html> at once; a value
// equal to the default is removed, so html[data-font] means the reader chose a font. The form shows what is stored.
// The reading ruler starts mid-screen and follows the pointer and the focused element through a CSSOM write, which the
// CSP allows (ADR 0001, experiment g). It stays below the sticky header (src/header.ts) and sits under it while the dialog is open.
import { clearHeader, headerBottom } from './header.ts';

const KEY = 'nbl:settings';
const html = document.documentElement;
const form = document.querySelector<HTMLFormElement>('#settings-form');
const ruler = document.querySelector<HTMLElement>('.ruler');

const stored = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {}; // no storage, or a value that is not JSON: the defaults stand
  }
};
// As boot.js: "Same as my device" is more contrast if the device asks for it, else its colour scheme.
const device = (query: string) => matchMedia(query).matches;
const deviceTheme = () => (device('(prefers-contrast: more)') ? 'contrast' : device('(prefers-color-scheme: dark)') ? 'dark' : 'light');

if (form) {
  // form.elements also holds the map's own Hide my progress switch (form="settings-form", spec 7).
  const inputs = [...form.elements].filter((el) => el instanceof HTMLInputElement);
  // The defaults are the options Settings.astro marks checked, so the markup is their one source.
  const DEFAULTS = Object.fromEntries(inputs.filter((input) => input.defaultChecked).map((input) => [input.name, input.value]));
  const shown = { ...DEFAULTS, ...stored() };
  for (const input of inputs) input.checked = shown[input.name] === input.value;

  // A change event reaches the form's ancestors only, so the map's switch is heard on the document.
  addEventListener('change', (e) => {
    const changed = e.target as HTMLInputElement;
    if (changed.form !== form) return;
    // Two switches, one setting: the one changed sets its twin before the form is read.
    for (const input of inputs) if (input.type === 'checkbox' && input.name === changed.name) input.checked = changed.checked;
    const data = new FormData(form);
    const next = stored();
    for (const name of new Set(inputs.map((input) => input.name))) {
      // A switch that starts on (the lesson sidebar) sends nothing when off, so it is stored as off.
      const value = data.get(name) ?? (DEFAULTS[name] ? 'off' : null);
      const chosen = typeof value === 'string' && value !== DEFAULTS[name];
      if (chosen) next[name] = value;
      else delete next[name];
      if (name !== 'theme') chosen ? html.setAttribute(`data-${name}`, value) : html.removeAttribute(`data-${name}`);
    }
    html.dataset.theme = next.theme ?? deviceTheme();
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // no storage: this page still changes, the next one starts from the defaults
    }
  });

  // The lesson sidebar's Hide contents and Contents buttons (run 26) flip its switch, so the choice is stored like any
  // other; focus moves to the button that undoes it.
  const sidebar = form.elements.namedItem('sidebar') as HTMLInputElement;
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('.sidebar-toggle')];
  const expanded = () => {
    for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(sidebar.checked));
  };
  expanded();
  addEventListener('change', expanded);
  for (const toggle of toggles)
    toggle.addEventListener('click', () => {
      sidebar.checked = !sidebar.checked;
      sidebar.dispatchEvent(new Event('change', { bubbles: true }));
      toggles.find((other) => other !== toggle)?.focus();
    });
}

if (ruler) {
  // The line the ruler is on, kept between the header and the bottom of the window.
  const place = (y: number) => {
    const half = ruler.offsetHeight / 2;
    ruler.style.top = `${Math.max(headerBottom() + 4, Math.min(innerHeight - 2 * half, y - half))}px`;
  };
  addEventListener('pointermove', (e) => place(e.clientY));
  // The ruler follows the keyboard: a focused control is first cleared of the header, then the ruler is set on it.
  addEventListener('focusin', (e) => {
    const target = e.target as Element;
    if (target.closest('dialog, .site-header, .skip')) return;
    const box = clearHeader(target);
    place(box.top + Math.min(box.height, innerHeight - headerBottom()) / 2);
  });
}
