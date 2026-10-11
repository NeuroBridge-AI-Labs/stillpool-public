// The colours the theme tokens do not hold (src/styles/activities.css): the five speakers and the warning. In every theme
// white on a speaker, the text on its row, the text on the warning and the warning's tag, and the second AI's initial on
// its colour, are 4.5:1 or more (7:1 in high contrast, as check:contrast asks of words).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hex = (css: string) => css.trim().replace(/^#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3');
const rgb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, pa: number) => `#${rgb(a).map((v, i) => Math.round(v * pa + rgb(b)[i] * (1 - pa)).toString(16).padStart(2, '0')).join('')}`;
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
// the same weights as e2e/layout.spec.ts, on the colour values as they are
const light = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const vars = (css: string, selector: string) => new Map([...(new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)].map(([, k, v]) => [k, hex(v)]));

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const css = readFileSync('src/styles/activities.css', 'utf8');
const base = vars(css, ':root');

describe('activity colours', () => {
  for (const theme of ['light', 'dark', 'contrast']) {
    const t = vars(tokens, `\\[data-theme="${theme}"\\]`);
    const own = new Map([...base, ...vars(css, `\\[data-theme="${theme}"\\]`)]);
    const floor = theme === 'contrast' ? 7 : 4.5;
    it(`${theme}: the speakers, the warning and the second AI read`, () => {
      expect(own.size).toBeGreaterThan(5);
      const dark = theme === 'dark';
      for (const n of [1, 2, 3, 4, 5]) {
        const sp = own.get(`sp-${n}`)!;
        // light and high contrast: white on the speaker's colour; dark: the initial on a chip darkened from it, ringed in it
        const chip = dark ? mix(sp, '#000000', 0.1) : sp;
        const row = dark ? mix(sp, '#000000', 0.1) : mix(sp, t.get('surface')!, 0.09);
        expect(ratio(dark ? t.get('text')! : '#ffffff', chip), `initial on speaker ${n}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(sp, t.get('ground')!), `speaker ${n}'s stripe on the ground`).toBeGreaterThanOrEqual(3);
        expect(ratio(t.get('text')!, row), `text on speaker ${n}'s row`).toBeGreaterThanOrEqual(floor);
        expect(ratio(t.get('text-muted')!, row), `role on speaker ${n}'s row`).toBeGreaterThanOrEqual(4.5);
        if (dark) for (const fill of [chip, row]) expect(light(fill), `speaker ${n} fill is no lighter than the ground`).toBeLessThanOrEqual(light(t.get('ground')!));
      }
      if (dark) expect(light(own.get('warn-tint')!), 'the warning is no lighter than the ground').toBeLessThanOrEqual(light(t.get('ground')!));
      expect(ratio(t.get('text')!, own.get('warn-tint')!), 'text on the warning').toBeGreaterThanOrEqual(floor);
      expect(ratio(own.get('warn-tint')!, own.get('warn')!), 'the tag on the warning').toBeGreaterThanOrEqual(4.5);
      expect(ratio(own.get('warn')!, own.get('warn-tint')!), 'the underline on the warning').toBeGreaterThanOrEqual(3);
      expect(ratio(t.get('ground')!, t.get('accent-2-ink')!), "the second AI's initial").toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.get('on-accent')!, t.get('accent')!), "the first AI's initial").toBeGreaterThanOrEqual(4.5);
    });
  }
});
