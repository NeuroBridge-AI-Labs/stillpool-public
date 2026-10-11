# ADR 0003: The deploy headers and build settings live in `vercel.json`

- **Status:** accepted, 27-09-26 (Phase 5, PR 12, after Emanuel's Vercel OK, Q9). **Enforced by:**
  `e2e/live/live.spec.ts`, run with `LIVE_URL=<deploy> bunx playwright test -c playwright.live.config.ts`.
- **Files:** `vercel.json`, written fresh (NBEDU's is never copied).

## Decision

- **Deploy:** Vercel's GitHub integration. Production from `main`, a preview for every other branch.
- **One header list on every path** (`/(.*)`), the list ADR 0001 names: `Content-Security-Policy: frame-ancestors
  'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000`,
  `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(),
  microphone=(), geolocation=()`, `X-Robots-Tag: noindex`.
- **No other CSP header.** The page's `<meta>` policy (ADR 0001) does the rest; a header with `default-src`,
  `script-src` or `style-src` would block the islands, and one on `/pagefind/*` would break the search worker (F6).
  This drops ADR 0001's `default-src 'none'; sandbox` for `public/`: it holds only our fonts, PNG logos, icons and
  `licences.txt`, nothing that runs, and `nosniff` keeps each one its own type.
- **HSTS without `includeSubDomains` or `preload`:** the site is on `*.vercel.app` for now; a custom domain decides
  those two when it comes. This replaces Vercel's own `max-age=63072000; includeSubDomains; preload` on `vercel.app`,
  and changes nothing there: the whole `.app` TLD is HSTS-preloaded in every major browser.
- **Build settings in `vercel.json`**, so a change is reviewed: framework `astro`, install
  `bun install --frozen-lockfile`, build `bun run build`, output `dist`.

## Settings that stay in the Vercel project

`vercel.json` cannot hold these. Set once, with Emanuel's OK:

| Setting | Value | Why |
|---|---|---|
| Production Branch | `main` | The Decision's "Production from `main`" |
| Node.js version | 22.x | `package.json` `engines` also pins `>=22.19 <23` |
| Environment variable | `PUBLIC_ANALYTICS=1`, Production and Preview | The one count (D11) and its `connect-src 'self'` |
| Web Analytics | on | Serves `/_vercel/insights/` |
| Speed Insights | off | Another Vercel script, and not the one count |
| Deployment Protection | Vercel Authentication off for previews | Testers have no Vercel account |
| Vercel Toolbar | off, previews and production | It injects a script from `vercel.live`: the meta CSP blocks it only if it is injected after the meta, and the live probe fails on it either way |

Vercel picks its own Bun, not `packageManager`'s `bun@1.2.19`. The text `bun.lock` keeps `--frozen-lockfile` working
across 1.2.x, and it holds the linux-x64 bindings the build needs (Pagefind, Rolldown, Tailwind's oxide, lightningcss).

## What proves it

- **Local** (`vercel.json`'s headers applied by a throwaway static server to a `PUBLIC_ANALYTICS=1` build, with a stub
  counting script): the four live tests pass; without `vercel.json`, the three header tests fail; a restrictive header
  CSP fails three; a counting script that sends `NBL1` fails S3; with both S3 layers removed (the loader's hash
  check and `restore.ts`'s hop to `/`), `/done/...#p=` sends the code and S3 fails. The stub bails under automation
  like the hosted `script.js` 0.1.3 (`navigator.webdriver`, or `Headless` in the UA), and the proof holds with that real
  script served in its place; so the live config hides both, and S3 pins the count's `o` to the bare `/done` URL.
- **Only the live run proves:** Vercel's own path matching and header merging, the headers on its 404, what the
  hosted counting script really sends (F12, recorded from an `https://` run only into
  `e2e/fixtures/analytics-request.json` and committed after the first run), that no toolbar or other host script
  appears, and HSTS over HTTPS.
- **Each live run records one or two real views in Web Analytics,** so run it against a preview URL where one exists.
