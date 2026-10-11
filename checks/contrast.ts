// check:contrast. Every [data-theme] block in <target>/tokens.css sets the 14 colour tokens of the theme contract
// (docs/adr/0002-themes.md) as #rgb or #rrggbb and its two border widths, and every pair meets its WCAG 2.x floor,
// unrounded: words 4.5:1 (7:1 in the theme named contrast), interface 3:1, on each of the three surfaces. light's
// ground is never white; light, dark and contrast all appear.
import { readFileSync } from 'node:fs';

const NAME = 'contrast';
const TEXT_MIN = 4.5; // WCAG 1.4.3, text and links
const UI_MIN = 3; // WCAG 1.4.11, non-text interface
const CONTRAST_MIN = 7; // WCAG 1.4.6, the text floor of the theme named contrast
const TOKENS = ['ground', 'surface', 'surface-raised', 'text', 'text-muted', 'link', 'accent-2-ink', 'focus', 'accent', 'on-accent',
  'border', 'state-todo', 'state-done', 'state-here'];
const WIDTHS = ['border-width', 'border-width-strong']; // per theme, so high contrast can thicken them
const THEMES = ['light', 'dark', 'contrast'];
const onAll = (tokens: string[], floor: number) =>
  tokens.flatMap((t) => ['ground', 'surface', 'surface-raised'].map((bg) => [t, bg, floor] as const));

const luminance = (hex: string) => {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['src/styles']) {
  let css = '';
  try {
    css = readFileSync(`${target}/tokens.css`, 'utf8');
  } catch {
    // a missing tokens.css has no themes: nothing to check, below
  }
  const themes = [...css.matchAll(/\[data-theme="([^"]*)"\]\s*\{([\s\S]*?)\}/g)];
  if (!themes.length) {
    findings.push(`${NAME}: nothing to check in ${target}`);
    continue;
  }
  for (const [, theme, body] of themes) {
    const vars = new Map([...body.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)].map(([, name, value]) => [name, value.trim()]));
    for (const name of TOKENS) {
      const value = vars.get(name);
      if (value === undefined) findings.push(`${NAME}: ${theme}: missing --${name}`);
      else if (!/^#(?:[\da-fA-F]{3}){1,2}$/.test(value)) {
        findings.push(`${NAME}: ${theme}: --${name} is not #rgb or #rrggbb`);
        vars.delete(name);
      }
    }
    for (const name of WIDTHS) {
      const value = vars.get(name);
      if (value === undefined) findings.push(`${NAME}: ${theme}: missing --${name}`);
      else if (!/^\d+(?:\.\d+)?px$/.test(value) || Number.parseFloat(value) < 1) findings.push(`${NAME}: ${theme}: --${name} is not 1px or more`);
    }
    if (theme === 'light' && /^#f{3}(?:f{3})?$/i.test(vars.get('ground') ?? '')) findings.push(`${NAME}: light: ground is ${vars.get('ground')}`);
    const words = theme === 'contrast' ? CONTRAST_MIN : TEXT_MIN;
    const pairs = [
      ...onAll(['text', 'text-muted', 'link', 'accent-2-ink'], words),
      ['on-accent', 'accent', words] as const,
      ...onAll(['focus', 'border', 'state-todo', 'state-done', 'state-here'], UI_MIN),
    ];
    for (const [fg, bg, min] of pairs) {
      const [a, b] = [vars.get(fg), vars.get(bg)];
      if (!a || !b) continue;
      const r = ratio(a, b);
      if (r < min) findings.push(`${NAME}: ${theme}: ${fg} on ${bg} ${r.toFixed(2)}:1 < ${min}:1`);
    }
  }
  const seen = themes.map(([, theme]) => theme);
  for (const name of THEMES) if (!seen.includes(name)) findings.push(`${NAME}: missing theme ${name}`);
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
