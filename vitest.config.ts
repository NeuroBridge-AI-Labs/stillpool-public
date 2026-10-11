import { getViteConfig } from 'astro/config';

// Astro's own Vite config, so a test can import a .astro component (src/components/take.test.ts).
export default getViteConfig({});
