// The feedback page's one server function (FB1). It checks one learner message and forwards it once to our own workflow
// tool, which saves it in a table. Guards are shared with the lab in ./_guard.js (the .ts source; the host loads the compiled .js). The page imports MAX_MESSAGE from here.
// Env: FEEDBACK_ENABLED (must be "1"), FEEDBACK_URL, FEEDBACK_TOKEN. Missing means closed.
import { MAX_BODY, finish, guardedRead, isObject, refuse, type Refusal } from './_guard.js';

export const MAX_MESSAGE = 1500;
export type Feedback = { about: string; message: string };

// "site" and "lab" are the two fixed options; any other value is a lesson id, pillar/slug.
const ABOUT = /^(?:site|lab|[a-z0-9-]+\/[a-z0-9-]+)$/;

export function checkFeedback(raw: string): Feedback | Refusal {
  if (new TextEncoder().encode(raw).length > MAX_BODY) return refuse(413, 'too_large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse(400, 'bad_request');
  }
  if (!isObject(body) || Object.keys(body).sort().join() !== 'about,message') return refuse(400, 'bad_request');
  const { about, message } = body;
  const valid =
    typeof about === 'string' && about.length <= 120 && ABOUT.test(about) && typeof message === 'string' && message.trim().length >= 1 && message.trim().length <= MAX_MESSAGE;
  return valid ? { about, message: message.trim() } : refuse(400, 'bad_request');
}

// One call, no retry. Any 2xx is success; every other result, and a timeout, is "busy". Nothing upstream is returned or logged.
async function save({ about, message }: Feedback): Promise<[number, unknown]> {
  try {
    const res = await fetch(process.env.FEEDBACK_URL!, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-stillpool-token': process.env.FEEDBACK_TOKEN! },
      body: JSON.stringify({ message, about, source: 'stillpool' }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error', // one fixed address, never followed elsewhere
    });
    await res.body?.cancel().catch(() => {});
    return res.ok ? [200, { ok: true }] : [503, { error: 'busy' }];
  } catch {
    return [503, { error: 'busy' }];
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const started = Date.now();
    const done = (status: number, body: unknown, headers?: Record<string, string>) => finish('feedback', started, status, body, {}, headers); // never the message, token or address
    if (process.env.FEEDBACK_ENABLED !== '1' || !process.env.FEEDBACK_URL || !process.env.FEEDBACK_TOKEN) return done(503, { error: 'closed' });
    const raw = await guardedRead(request, done);
    if (raw instanceof Response) return raw;
    const checked = checkFeedback(raw);
    if ('status' in checked) return done(checked.status, { error: checked.error });
    const [status, body] = await save(checked);
    return done(status, body);
  },
};
