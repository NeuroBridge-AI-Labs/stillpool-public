import { defineConfig } from '@playwright/test';

// E2E_PORT lets a second run (a reviewer, a merge gate) use its own port: a decimal port, so the shell command gets a
// number and 0 or 0x1130 fail at once (fold-review NICE 1).
const port = Number(process.env.E2E_PORT || 4399);
if (!/^\d+$/.test(process.env.E2E_PORT || '4399') || port < 1024 || port > 65534) throw new Error('E2E_PORT must be a port number from 1024 to 65534');

const preview = (outDir: string, at: number) => `ASTRO_TELEMETRY_DISABLED=1 astro preview --outDir ${outDir} --host 127.0.0.1 --port ${at} --ignore-lock`;

// Two sites: dist, and dist-fixture, where the recorded-answer interactives read fixtures/recorded (PR 11); only e2e/recorded/ uses it.
// e2e/live runs only against a deployed site (playwright.live.config.ts).
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 0,
  projects: [
    { name: 'site', testIgnore: ['recorded/**', 'live/**'], use: { baseURL: `http://127.0.0.1:${port}` } },
    { name: 'fixture', testMatch: 'recorded/**/*.spec.ts', use: { baseURL: `http://127.0.0.1:${port + 1}` } },
  ],
  webServer: [
    { command: preview('dist', port), url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
    {
      command: `RECORDED_FIXTURE=1 ASTRO_TELEMETRY_DISABLED=1 astro build --outDir dist-fixture && ${preview('dist-fixture', port + 1)}`,
      url: `http://127.0.0.1:${port + 1}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
