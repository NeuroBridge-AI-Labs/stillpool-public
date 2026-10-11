// The practice lab's one server function (lab-spec, ADR 0004). The request guards live in api/_guard.ts, shared with the
// feedback function. The page imports EXERCISES and MAX_PROMPT from here, so each rule lives once.
// Env: LAB_ENABLED (must be "1"), MISTRAL_API_KEY, MISTRAL_AGENT_ID, MISTRAL_AGENT_VERSION (optional whole number).
import { MAX_BODY, finish, guardedRead, headerRefusal, isObject, readText, refuse, type Refusal } from './_guard.js';

export const MAX_PROMPT = 1000;
export const MODEL = { name: 'Mistral Large', id: 'mistral-large-2512' } as const;
export const EXERCISES = {
  'bad-and-good-prompts': { title: 'Bad and good prompts', task: 'Write a prompt asking an AI for a short thank-you note to a neighbour who minded a pet. Say what you want and who it is for.' },
  context: { title: 'Context', task: 'Write a prompt asking for a packing list for a two-day trip. Give the context the AI needs: the place, the season and how you travel.' },
  examples: { title: 'Examples', task: 'Write a prompt asking for three names for a community garden. Include one or two example names, so the AI can see the style you like.' },
  format: { title: 'Format', task: 'Write a prompt asking how to make a cup of tea. Say what shape the answer should take, such as numbered steps, and how long it should be.' },
  'roles-and-ground-rules': { title: 'Roles and ground rules', task: 'Write a prompt that gives the AI a role, such as a patient tutor, and two ground rules. Then ask it to explain what a budget is.' },
  'iterate-and-check': { title: 'Iterate and check', task: 'A first prompt said: "Tell me about bees." Write a better second version. Add one thing that helps you check the answer, such as asking the AI to say when it is unsure.' },
} as const;

export type ExerciseId = keyof typeof EXERCISES;
export type Checked = { exercise: ExerciseId; prompt: string; example: boolean };
export type { Refusal };
export type Reply = { ai_answer: string; worked: string; try_next: string; why: string; example_prompt: string | null; note: string | null };

const MAX_FIELD = 2000;
const MAX_UPSTREAM = 64 * 1024; // documented ceiling for Mistral's body: the reply is six strings of at most 2,000 characters
const upstreamUrl = 'https://api.mistral.ai/v1/conversations';

export function checkRequest(method: string, headers: Headers, raw: string): Checked | Refusal {
  const early = headerRefusal(method, headers);
  if (early) return early;
  if (new TextEncoder().encode(raw).length > MAX_BODY) return refuse(413, 'too_large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse(400, 'bad_request');
  }
  const { exercise, prompt, example } = isObject(body) ? body : ({} as Record<string, unknown>);
  const valid =
    isObject(body) &&
    Object.keys(body).sort().join() === 'example,exercise,prompt' &&
    typeof exercise === 'string' &&
    Object.hasOwn(EXERCISES, exercise) &&
    typeof prompt === 'string' &&
    prompt.trim().length >= 1 &&
    prompt.trim().length <= MAX_PROMPT &&
    typeof example === 'boolean';
  return valid ? { exercise: exercise as ExerciseId, prompt, example } : refuse(400, 'bad_request');
}

// Learner text cannot close (or reopen) the delimiter: a run of three or more brackets is spread out.
const spread = (run: string) => [...run].join(' ');
export const buildInput = (exercise: ExerciseId, prompt: string, example: boolean) =>
  `TASK: ${EXERCISES[exercise].task}\nPROMPT: <<<${prompt.replace(/<{3,}|>{3,}/g, spread)}>>>\nEXAMPLE: ${example ? 'yes' : 'no'}`;

// Only these six fields leave the function. Anything else Mistral sent is dropped, and the page shows them as text.
export function checkReply(content: unknown): Reply | null {
  if (typeof content !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const required = (v: unknown) => (typeof v === 'string' && v.trim() ? v.slice(0, MAX_FIELD) : null);
  const optional = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'string' ? v.slice(0, MAX_FIELD) : undefined);
  const [ai_answer, worked, try_next, why] = [value.ai_answer, value.worked, value.try_next, value.why].map(required);
  const [example_prompt, note] = [value.example_prompt, value.note].map(optional);
  if (ai_answer === null || worked === null || try_next === null || why === null || example_prompt === undefined || note === undefined) return null;
  return { ai_answer, worked, try_next, why, example_prompt, note };
}

// A reply's text is a string, or chunks that carry `text` (lab-spec P4 is not verified, so both are read).
const textOf = (content: unknown): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (isObject(c) && typeof c.text === 'string' ? c.text : '')).join('') : '';

// Mistral's moderation answers 403 with exactly this body (seen 10-10-26): code 3200 and a guardrails array whose entry holds
// an object with action "block". Nothing looser counts: any other 403 is our key or our access, so the lab is closed.
// That is the learner's prompt being stopped, not a closed lab. Nothing from the body is kept, returned or logged.
async function guardrailBlock(res: Response): Promise<boolean> {
  try {
    const body = JSON.parse((await readText(res.body, MAX_UPSTREAM)) ?? '');
    return (
      isObject(body) &&
      body.code === 3200 &&
      Array.isArray(body.guardrails) &&
      body.guardrails.some((entry) => isObject(entry) && Object.values(entry).some((v) => isObject(v) && v.action === 'block'))
    );
  } catch {
    return false;
  }
}

async function ask(input: string): Promise<[number, unknown]> {
  const version = /^\d+$/.test(process.env.MISTRAL_AGENT_VERSION ?? '') ? { agent_version: Number(process.env.MISTRAL_AGENT_VERSION) } : {};
  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: process.env.MISTRAL_AGENT_ID, ...version, inputs: input, store: false, stream: false }),
      signal: AbortSignal.timeout(20_000),
      redirect: 'error', // one fixed host, never followed elsewhere
    });
  } catch (error) {
    console.log(JSON.stringify({ lab: 1, upstream: error instanceof Error ? error.name : 'unknown' }));
    return error instanceof Error && error.name === 'TimeoutError' ? [504, { error: 'timeout' }] : [503, { error: 'busy' }];
  }
  // A 403 that is the moderation block: a 200 the page shows as a calm line, with no detail of the block.
  if (res.status === 403 && (await guardrailBlock(res))) return [200, { filtered: true }];
  // 401 and 403: our key is gone or wrong, so closed. 429 is Mistral's limit, spend or rate (lab-spec C): busy, try later.
  if (res.status === 401 || res.status === 403) return [503, { error: 'closed' }];
  if (res.status === 429 || res.status >= 500) return [503, { error: 'busy' }];
  if (!res.ok) return [502, { error: 'bad_reply' }];
  try {
    const raw = await readText(res.body, MAX_UPSTREAM);
    const outputs = raw === undefined ? undefined : (JSON.parse(raw) as { outputs?: unknown }).outputs;
    const reply = Array.isArray(outputs) ? checkReply(outputs.map((o) => textOf(isObject(o) ? o.content : '')).join('')) : null;
    return reply ? [200, reply] : [502, { error: 'bad_reply' }];
  } catch (error) {
    return error instanceof Error && error.name === 'TimeoutError' ? [504, { error: 'timeout' }] : [502, { error: 'bad_reply' }];
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const started = Date.now();
    let exercise: string | undefined;
    const done = (status: number, body: unknown, headers?: Record<string, string>) => finish('lab', started, status, body, { exercise }, headers); // never the prompt, reply, header or IP
    // Missing means closed: nothing is read or sent unless the switch and both secrets are set.
    if (process.env.LAB_ENABLED !== '1' || !process.env.MISTRAL_API_KEY || !process.env.MISTRAL_AGENT_ID) return done(503, { error: 'closed' });
    const raw = await guardedRead(request, done);
    if (raw instanceof Response) return raw;
    const checked = checkRequest(request.method, request.headers, raw);
    if ('status' in checked) return done(checked.status, { error: checked.error });
    exercise = checked.exercise;
    const [status, body] = await ask(buildInput(checked.exercise, checked.prompt, checked.example));
    return done(status, body);
  },
};
