# ADR 0004: The practice lab is the one live AI call, through one function

- **Status:** accepted for build, 09-10-26 (Emanuel's decisions of 26-09-26 and 08-10-26). **Spec:** `.ops/p45/lab-spec.md`.
  **Enforced by:** `src/lab-api.test.ts`, `src/lab.test.ts`, `e2e/lab.spec.ts` and `e2e/analytics.spec.ts`.
- **Files:** `api/lab.ts`, `src/pages/lab.astro`, `src/lab.ts`, `src/lab-page.ts`, `vercel.json`.

## Decision

- **One page, one function.** `/lab/` is static. The page sends `{exercise, prompt, example}` with `fetch` to `/api/lab/` (the address Vercel serves: `trailingSlash` is on, so `/api/lab` answers 308), and only
  after the learner has passed the notice and pressed Send. `api/lab.ts` is a plain Vercel Function: no adapter, no SDK, no
  database, no new dependency, and its one import is the shared request guards in `api/_guard.ts`. It validates, builds `TASK / PROMPT / EXAMPLE` from its own exercise table, calls the
  Mistral agent once with `store: false`, checks the six reply fields and returns only those.
- **The only exception to "no live AI calls".** `CLAUDE.md` and the plan name it. No lesson, footer link or other page calls it.
  The page's CSP gains `connect-src 'self'` on this page alone (`Astro.csp.insertDirective`); `e2e/analytics.spec.ts` fails if a
  second page connects.
- **Text, never HTML.** Every reply field is written with `textContent`. The function and the page both reject anything that is
  not the six text fields.
- **Closed unless set.** `LAB_ENABLED` must be `1` and the key and agent id must exist, or the function answers 503 `closed`
  without calling anything. The page shows the form until a send returns `closed`.

## The three controls (all outside the code where they can be)

| Control | Where | Note |
|---|---|---|
| Spend cap | A monthly limit on a Mistral Workspace that holds only the lab | Monthly, not daily. Mistral's 429 is read as "busy": try again later, the lab is not closed. A moderation 403 is a 200 `filtered`, other 403s are `closed` |
| Per-visitor limit | One Vercel WAF rate-limit rule on `/api/lab/`, set by the owner | `vercel.json` cannot hold a rate limit (spec V6). If the rule is missing, nothing in the code limits anyone |
| Kill switch | `LAB_ENABLED` (redeploy), or delete the Mistral key (instant) | |

## What is not verified

- **V3 and probe P1:** whether a root `api/` folder works beside the Astro static preset on Vercel. Not run from the build
  environment. If the preview answers 404, take fallback F1 in the spec (adds `@astrojs/vercel`) only after asking.
- **P3 and P4:** the host headers on a real send, and the shape of `outputs[0].content`. The function reads `content` as a string or
  as chunks with `text`, and rejects everything else as 502.
- **What Mistral keeps.** The privacy page makes no claim about it.
