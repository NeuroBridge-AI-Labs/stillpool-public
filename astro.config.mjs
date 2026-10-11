import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// CSP and Prism: measured in docs/adr/0001-csp.md. Deny by default; each new need is one reviewed line.
// Astro hashes no is:inline script, so the boot script's hash comes from the file itself: the page and the
// policy cannot drift apart (ADR 0001, D2).
const boot = readFileSync(new URL('./src/boot.js', import.meta.url), 'utf8');
// The count posts to its own origin, so only a build with it may connect (D11, F11), and /lab/ adds its own (lab-spec).
const count = process.env.PUBLIC_ANALYTICS === '1' ? ["connect-src 'self'"] : [];

export default defineConfig({
  site: 'https://learn.neurobridgeedu.eu',
  integrations: [mdx()],
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } }, // scripts stay files: one cached copy, not one per page (check:budget)
  markdown: { syntaxHighlight: 'prism' },
  devToolbar: { enabled: false }, // its Astro app fetches from astro.build
  security: {
    csp: {
      // media-src: Emma's audio files, same-origin, played only after Read aloud (src/readaloud.ts).
      directives: ["default-src 'none'", "img-src 'self'", "font-src 'self'", "media-src 'self'", "base-uri 'none'", "form-action 'none'", ...count],
      scriptDirective: { hashes: [`sha256-${createHash('sha256').update(boot).digest('base64')}`] },
    },
  },
});
