import { defineConfig } from '@playwright/test';

// The live probe (plan PR 12, ADR 0003): e2e/live against a deployed site, so no web server here. LIVE_URL is an origin.
const url = process.env.LIVE_URL ?? '';
if (!/^https?:\/\/[^/]+$/.test(url)) throw new Error('LIVE_URL must be an origin, like https://stillpool.vercel.app');

export default defineConfig({ testDir: 'e2e/live', workers: 1, retries: 0, use: { baseURL: url,
  // Vercel's hosted script.js (0.1.3) sends nothing when navigator.webdriver is set or the UA says Headless, so the live runs hide both.
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] } } });
