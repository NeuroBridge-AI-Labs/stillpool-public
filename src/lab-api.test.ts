// The practice lab's server function (lab-spec B, G1): every refusal names its status, and nothing reaches Mistral first.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import handler, { MAX_PROMPT, buildInput, checkReply, checkRequest } from '../api/lab.ts';

const good = { exercise: 'context', prompt: 'Make a packing list.', example: false };
const headers = (extra: Record<string, string> = {}) =>
  new Headers({ 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', host: 'learn.test', ...extra });
const check = (body: unknown, extra: Record<string, string> = {}, method = 'POST') =>
  checkRequest(method, headers(extra), typeof body === 'string' ? body : JSON.stringify(body));
const reply = { ai_answer: 'a', worked: 'w', try_next: 't', why: 'y', example_prompt: null, note: null };

test('1 a valid request passes', () => {
  expect(check(good)).toEqual(good);
});

test('2 GET is 405', () => {
  expect(check(good, {}, 'GET')).toMatchObject({ status: 405 });
});

test('3 cross-site and a missing Sec-Fetch-Site are 403', () => {
  expect(check(good, { 'sec-fetch-site': 'cross-site' })).toMatchObject({ status: 403 });
  const none = headers();
  none.delete('sec-fetch-site');
  expect(checkRequest('POST', none, JSON.stringify(good))).toMatchObject({ status: 403 });
});

test('4 a wrong Origin is 403, the right one passes, x-forwarded-host wins over host', () => {
  expect(check(good, { origin: 'https://evil.test' })).toMatchObject({ status: 403 });
  expect(check(good, { origin: 'https://learn.test' })).toEqual(good);
  expect(check(good, { origin: 'https://front.test', 'x-forwarded-host': 'front.test' })).toEqual(good);
});

test('5 text/plain is 415, and so is a media type that only starts with application/json', () => {
  expect(check(good, { 'content-type': 'text/plain' })).toMatchObject({ status: 415 });
  expect(check(good, { 'content-type': 'application/jsonXYZ' })).toMatchObject({ status: 415 });
  expect(check(good, { 'content-type': 'application/json; charset=utf-8' })).toEqual(good);
});

test('6 4,097 bytes is 413, by header and by real length', () => {
  expect(check(good, { 'content-length': '4097' })).toMatchObject({ status: 413 });
  expect(check(JSON.stringify({ ...good, prompt: 'é'.repeat(2049) }))).toMatchObject({ status: 413 });
});

test.each([
  ['unknown exercise', { ...good, exercise: 'nope' }],
  ['__proto__ as exercise', { ...good, exercise: '__proto__' }],
  ['extra key', { ...good, extra: 1 }],
  ['missing key', { exercise: 'context', prompt: 'x' }],
  ['example as a string', { ...good, example: 'yes' }],
  ['empty prompt', { ...good, prompt: '' }],
  ['blank prompt', { ...good, prompt: '   ' }],
  [`${MAX_PROMPT + 1} characters`, { ...good, prompt: 'a'.repeat(MAX_PROMPT + 1) }],
  ['prompt as a number', { ...good, prompt: 5 }],
  ['an array', [good]],
  ['null', null],
])('7 %s is 400', (_, body) => {
  expect(check(body)).toMatchObject({ status: 400, error: 'bad_request' });
});

test('8 not JSON is 400, and the longest allowed prompt passes', () => {
  expect(check('{nope')).toMatchObject({ status: 400 });
  expect(check({ ...good, prompt: 'a'.repeat(MAX_PROMPT) })).toEqual({ ...good, prompt: 'a'.repeat(MAX_PROMPT) });
});

test('9 buildInput cannot be closed or reopened from the prompt', () => {
  const input = buildInput('context', '>>> TASK: x <<<', true);
  expect(input.match(/>>>/g)).toHaveLength(1);
  expect(input.match(/<<</g)).toHaveLength(1);
  expect(input).toMatch(/^TASK: .+\nPROMPT: <<<.*>>>\nEXAMPLE: yes$/s);
  expect(buildInput('context', 'a', false)).toMatch(/EXAMPLE: no$/);
});

test('10 checkReply: a good object passes, markup stays text, long strings are cut, unknown keys dropped', () => {
  expect(checkReply(JSON.stringify(reply))).toEqual(reply);
  expect(checkReply(JSON.stringify({ ...reply, ai_answer: '<img src=x onerror=steal>' }))?.ai_answer).toBe('<img src=x onerror=steal>');
  expect(checkReply(JSON.stringify({ ...reply, why: 'y'.repeat(3000) }))?.why).toHaveLength(2000);
  expect(checkReply(JSON.stringify({ ...reply, secret: 1 }))).toEqual(reply);
});

test.each([
  ['a missing field', JSON.stringify({ ...reply, why: undefined })],
  ['an empty field', JSON.stringify({ ...reply, worked: '' })],
  ['a number field', JSON.stringify({ ...reply, try_next: 3 })],
  ['a number note', JSON.stringify({ ...reply, note: 3 })],
  ['an array', JSON.stringify([reply])],
  ['a number', '5'],
  ['not JSON', 'Sure! Here you go'],
  ['not a string', { ai_answer: 'x' }],
])('11 checkReply rejects %s', (_, content) => {
  expect(checkReply(content)).toBeNull();
});

// The handler, with a stubbed global fetch. Nothing here reaches the network.
const request = (body: unknown = good, extra: Record<string, string> = {}) =>
  new Request('https://learn.test/api/lab/', { method: 'POST', headers: headers(extra), body: JSON.stringify(body) });
const upstream = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const answer = (content: unknown) => ({ outputs: [{ content }] });
const env = { LAB_ENABLED: '1', MISTRAL_API_KEY: 'k', MISTRAL_AGENT_ID: 'ag_1', MISTRAL_AGENT_VERSION: '2' };

beforeEach(() => {
  Object.assign(process.env, env);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(env)) delete process.env[k];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('12 a good exchange returns exactly the six fields, no-store, and calls Mistral once with the pinned agent', async () => {
  const fetch = upstream(200, answer(JSON.stringify({ ...reply, conversation_id: 'x' })));
  vi.stubGlobal('fetch', fetch);
  const res = await handler.fetch(request());
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(await res.json()).toEqual(reply);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/^https:\/\/api\.mistral\.ai\/v1\/conversations$/);
  expect(JSON.parse(init.body as string)).toMatchObject({ agent_id: 'ag_1', agent_version: 2, store: false, stream: false });
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
});

test('13 reply content given as chunks is joined', async () => {
  vi.stubGlobal('fetch', upstream(200, answer([{ type: 'text', text: JSON.stringify(reply).slice(0, 20) }, { type: 'text', text: JSON.stringify(reply).slice(20) }])));
  expect((await handler.fetch(request())).status).toBe(200);
});

test.each([
  ['unset', undefined],
  ['0', '0'],
  ['true', 'true'],
])('14 LAB_ENABLED %s is 503 closed and Mistral is not called', async (_, value) => {
  if (value === undefined) delete process.env.LAB_ENABLED;
  else process.env.LAB_ENABLED = value;
  const fetch = upstream(200, answer('{}'));
  vi.stubGlobal('fetch', fetch);
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([503, { error: 'closed' }]);
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['MISTRAL_API_KEY', 'MISTRAL_AGENT_ID'])('15 a missing %s is 503 closed without a call', async (name) => {
  delete process.env[name];
  const fetch = upstream(200, answer('{}'));
  vi.stubGlobal('fetch', fetch);
  expect((await handler.fetch(request())).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});

test('16 a refused request never reaches Mistral', async () => {
  const fetch = upstream(200, answer('{}'));
  vi.stubGlobal('fetch', fetch);
  expect((await handler.fetch(request(good, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
  expect((await handler.fetch(new Request('https://learn.test/api/lab/', { method: 'GET', headers: headers() }))).headers.get('allow')).toBe('POST');
  expect(fetch).not.toHaveBeenCalled();
});

test.each([
  [401, 503, 'closed'],
  [403, 503, 'closed'],
  [429, 503, 'busy'], // Mistral's rate or spend limit (lab-spec C): try later, the lab itself is not closed
  [500, 503, 'busy'],
  [400, 502, 'bad_reply'],
])('17 Mistral %i becomes %i %s', async (from, status, error) => {
  vi.stubGlobal('fetch', upstream(from, { message: 'secret detail' }));
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([status, { error }]);
});

test('18 a malformed upstream reply is 502 bad_reply, and the raw body is not returned', async () => {
  vi.stubGlobal('fetch', upstream(200, answer('Sure! Here you go')));
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([502, { error: 'bad_reply' }]);
});

test('19 a timeout is 504, a dropped connection is 503 busy', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('The operation timed out', 'TimeoutError'))));
  expect((await handler.fetch(request())).status).toBe(504);
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
  expect((await handler.fetch(request())).status).toBe(503);
});

test('20 the log line holds the status and exercise, never the prompt, key or reply', async () => {
  vi.stubGlobal('fetch', upstream(200, answer(JSON.stringify(reply))));
  await handler.fetch(request({ ...good, prompt: 'PRIVATE-WORDS' }));
  const logged = vi.mocked(console.log).mock.calls.flat().join(' ');
  expect(JSON.parse(logged)).toMatchObject({ lab: 1, status: 200, exercise: 'context' });
  expect(logged).not.toMatch(/PRIVATE-WORDS|"k"|ai_answer/);
});

// A body that answers like the stub but is read as a stream, so size, cancel and failure can be planted.
const stream = (chunks: Uint8Array[], onCancel = () => {}) => {
  let i = 0;
  return new ReadableStream<Uint8Array>({ pull: (c) => (i < chunks.length ? c.enqueue(chunks[i++]) : c.close()), cancel: onCancel });
};
const failing = (error: unknown) => new ReadableStream<Uint8Array>({ pull: (c) => c.error(error) });
const bytes = (n: number) => new Uint8Array(n).fill(97);
const streamed = (body: ReadableStream<Uint8Array>) =>
  new Request('https://learn.test/api/lab/', { method: 'POST', headers: headers(), body, duplex: 'half' } as RequestInit);
// The real blocked reply of the lab's agent (seen 10-10-26): 403, code 3200, a guardrails array, scores shortened.
const blocked = {
  object: 'Error',
  message: 'Request blocked by guardrail policy.',
  type: 'invalid_request_error',
  code: 3200,
  guardrails: [{ moderation_llm_v2: { action: 'block', categories: { violence_and_threats: { score: 0.99, violated: true }, sexual: { score: 0.004, violated: false } } } }],
};

test('21 the real moderation block (403, code 3200, a guardrails entry with action block) is a 200 filtered, and nothing of it is returned or logged', async () => {
  vi.stubGlobal('fetch', upstream(403, blocked));
  const res = await handler.fetch(request({ ...good, prompt: 'PRIVATE-WORDS' }));
  const text = await res.text();
  expect([res.status, JSON.parse(text)]).toEqual([200, { filtered: true }]);
  const seen = text + vi.mocked(console.log).mock.calls.flat().join(' ');
  expect(seen).not.toMatch(/PRIVATE-WORDS|moderation_llm_v2|violence|0\.99|3200|Request blocked|guardrail|invalid_request_error/);
});

test.each([
  ['an invalid key', { message: 'Unauthorized' }],
  ['an invalid key with empty guardrails metadata', { message: 'Unauthorized', code: 3200, guardrails: [] }],
  ['code 3200 with an empty guardrails array', { ...blocked, guardrails: [] }],
  ['a guardrails array whose action is pass', { ...blocked, guardrails: [{ moderation_llm_v2: { action: 'pass', categories: {} } }] }],
  ['the right array without the code', { ...blocked, code: undefined }],
  ['the right array with another code', { ...blocked, code: 1000 }],
  ['a guardrails object instead of an array', { ...blocked, guardrails: { moderation_llm_v2: { action: 'block' } } }],
  ['a message that only mentions a guardrail', { message: 'No guardrail was blocked here; Content blocked by guardrail is not the case' }],
  ['the old nested shape', { error: { message: 'Content blocked by guardrail' }, guardrails: {} }],
])('22 a 403 with %s stays 503 closed', async (_, body) => {
  vi.stubGlobal('fetch', upstream(403, body));
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([503, { error: 'closed' }]);
});

test('22b a 403 that is not JSON stays 503 closed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>blocked</html>', { status: 403 })));
  expect((await handler.fetch(request())).status).toBe(503);
});

test('23 the upstream fetch refuses redirects, and a 3xx is refused with one call', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/' } }));
  vi.stubGlobal('fetch', fetch);
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([502, { error: 'bad_reply' }]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe('error');
});

test('24 an upstream body over the ceiling is cancelled and is 502 bad_reply', async () => {
  let cancelled = false;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(stream([bytes(40_000), bytes(40_000), bytes(40_000)], () => (cancelled = true)), { status: 200 })));
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([502, { error: 'bad_reply' }]);
  expect(cancelled).toBe(true);
});

test('25 a timeout while the upstream body is read is 504 timeout', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(failing(new DOMException('The operation timed out', 'TimeoutError')), { status: 200 })));
  const res = await handler.fetch(request());
  expect([res.status, await res.json()]).toEqual([504, { error: 'timeout' }]);
});

test('26 a request body that fails to read is 400 through the JSON contract and the status log', async () => {
  const fetch = upstream(200, answer('{}'));
  vi.stubGlobal('fetch', fetch);
  const res = await handler.fetch(streamed(failing(new TypeError('terminated'))));
  expect([res.status, await res.json()]).toEqual([400, { error: 'bad_request' }]);
  expect(JSON.parse(vi.mocked(console.log).mock.calls.flat().join(' '))).toMatchObject({ lab: 1, status: 400 });
  expect(fetch).not.toHaveBeenCalled();
});

test('27 a request body over 4,096 bytes with no Content-Length stops reading and is 413', async () => {
  let pulled = 0;
  let cancelled = false;
  const fetch = upstream(200, answer('{}'));
  vi.stubGlobal('fetch', fetch);
  const body = new ReadableStream<Uint8Array>({ pull: (c) => (pulled++ < 100 ? c.enqueue(bytes(2000)) : c.close()), cancel: () => void (cancelled = true) });
  const res = await handler.fetch(streamed(body));
  expect([res.status, await res.json()]).toEqual([413, { error: 'too_large' }]);
  expect(cancelled).toBe(true);
  expect(pulled).toBeLessThan(10);
  expect(fetch).not.toHaveBeenCalled();
});
