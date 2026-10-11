import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e', testMatch: 'a8.spec.ts', workers: 1, retries: 0,
  projects: ['chromium', 'webkit'].map((browserName) => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'webkit', baseURL: 'http://127.0.0.1:4703' } })),
  webServer: { command: 'ASTRO_TELEMETRY_DISABLED=1 astro preview --host 127.0.0.1 --port 4703 --ignore-lock', url: 'http://127.0.0.1:4703', reuseExistingServer: false },
});
