// The feedback function (FB1): every refusal names its status, nothing is sent upstream before the checks pass, and the one
// upstream call carries the token and the three fields. The global fetch is stubbed: nothing here reaches the network.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import handler, { MAX_MESSAGE, checkFeedback } from '../api/feedback.ts';

const good = { about: 'site', message: 'The lessons are clear.' };
const TOKEN = 'TOKEN-SECRET-9';
const URL_ = 'https://flow.example.test/hook/SECRET-PATH';
const env = { FEEDBACK_ENABLED: '1', FEEDBACK_URL: URL_, FEEDBACK_TOKEN: TOKEN };

const headers = (extra: Record<string, string> = {}) =>
  new Headers({ 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', host: 'learn.test', ...extra });
const request = (body: unknown = good, extra: Record<string, string> = {}, method = 'POST') =>
  new Request('https://learn.test/api/feedback/', { method, headers: headers(extra), body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const upstream = (status = 200, body: unknown = { id: 'row-1', private: 'UPSTREAM-DETAIL' }) =>
  vi.fn(async (..._args: unknown[]) => new Response(status === 204 ? null : JSON.stringify(body), { status }));

beforeEach(() => {
  Object.assign(process.env, env);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(env)) delete process.env[k];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const run = async (req: Request, fetchMock = upstream()) => {
  vi.stubGlobal('fetch', fetchMock);
  const res = await handler.fetch(req);
  return { res, body: await res.json(), fetchMock };
};

test('1 a valid message makes one upstream call with the token header and exactly three fields, and answers ok', async () => {
  const { res, body, fetchMock } = await run(request({ about: 'prompting/iterate-and-check', message: '  Helpful.  ' }));
  expect([res.status, body]).toEqual([200, { ok: true }]);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(URL_);
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string, string>)['x-stillpool-token']).toBe(TOKEN);
  expect(JSON.parse(init.body as string)).toEqual({ message: 'Helpful.', about: 'prompting/iterate-and-check', source: 'stillpool' });
  expect(init.redirect).toBe('error');
  expect(init.signal).toBeInstanceOf(AbortSignal);
});

test.each([
  ['FEEDBACK_ENABLED', undefined],
  ['FEEDBACK_ENABLED', '0'],
  ['FEEDBACK_URL', undefined],
  ['FEEDBACK_TOKEN', undefined],
])('2 closed when %s is %s: 503 closed, nothing read or sent', async (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  const { res, body, fetchMock } = await run(request());
  expect([res.status, body]).toEqual([503, { error: 'closed' }]);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('3 GET is 405 with Allow: POST', async () => {
  const { res, fetchMock } = await run(request(good, {}, 'GET'));
  expect(res.status).toBe(405);
  expect(res.headers.get('allow')).toBe('POST');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('4 cross-site, a missing Sec-Fetch-Site and a wrong Origin are 403', async () => {
  expect((await run(request(good, { 'sec-fetch-site': 'cross-site' }))).res.status).toBe(403);
  const bare = headers();
  bare.delete('sec-fetch-site');
  expect((await run(new Request('https://learn.test/api/feedback/', { method: 'POST', headers: bare, body: JSON.stringify(good) }))).res.status).toBe(403);
  expect((await run(request(good, { origin: 'https://evil.test' }))).res.status).toBe(403);
  expect((await run(request(good, { origin: 'https://learn.test' }))).res.status).toBe(200);
});

test('5 text/plain and application/jsonXYZ are 415', async () => {
  expect((await run(request(good, { 'content-type': 'text/plain' }))).res.status).toBe(415);
  expect((await run(request(good, { 'content-type': 'application/jsonXYZ' }))).res.status).toBe(415);
  expect((await run(request(good, { 'content-type': 'application/json; charset=utf-8' }))).res.status).toBe(200);
});

test('6 a body over 4,096 bytes is 413, by header and by the real length, and is never sent on', async () => {
  const a = await run(request(good, { 'content-length': '4097' }));
  expect(a.res.status).toBe(413);
  const b = await run(request({ ...good, message: 'é'.repeat(2049) }));
  expect(b.res.status).toBe(413);
  expect(a.fetchMock).not.toHaveBeenCalled();
  expect(b.fetchMock).not.toHaveBeenCalled();
});

test.each([
  ['not JSON', 'nope'],
  ['an array', [good]],
  ['null', null],
  ['an extra key', { ...good, extra: 1 }],
  ['a missing key', { message: 'x' }],
  ['about as a number', { about: 5, message: 'x' }],
  ['message as a number', { about: 'site', message: 5 }],
  ['an empty message', { about: 'site', message: '' }],
  ['a blank message', { about: 'site', message: '   ' }],
  [`${MAX_MESSAGE + 1} characters`, { about: 'site', message: 'a'.repeat(MAX_MESSAGE + 1) }],
  ['about: Site', { about: 'Site', message: 'x' }],
  ['about: a lesson with no slash', { about: 'prompting', message: 'x' }],
  ['about: a path', { about: 'a/b/c', message: 'x' }],
  ['about: with a space', { about: 'a/b c', message: 'x' }],
  ['about: __proto__', { about: '__proto__', message: 'x' }],
  ['about: over 120 characters', { about: `${'a'.repeat(60)}/${'b'.repeat(60)}`, message: 'x' }],
])('7 %s is 400 and nothing is sent upstream', async (_, body) => {
  const { res, body: reply, fetchMock } = await run(request(body));
  expect([res.status, reply]).toEqual([400, { error: 'bad_request' }]);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('8 the longest message, and about at exactly 120 characters, pass', () => {
  expect(checkFeedback(JSON.stringify({ about: 'site', message: 'a'.repeat(MAX_MESSAGE) }))).toMatchObject({ about: 'site' });
  expect(checkFeedback(JSON.stringify({ about: `${'a'.repeat(59)}/${'b'.repeat(60)}`, message: 'x' }))).toMatchObject({ message: 'x' });
});

test.each([[302], [400], [401], [404], [429], [500]])('9 upstream %i is 503 busy, and no upstream body is passed on', async (from) => {
  const { res, body } = await run(request(), upstream(from));
  expect([res.status, body]).toEqual([503, { error: 'busy' }]);
});

test.each([[201], [204]])('9b upstream %i is saved: 200 ok', async (from) => {
  const { res, body } = await run(request(), upstream(from, null));
  expect([res.status, body]).toEqual([200, { ok: true }]);
});

test('10 an upstream timeout, a refused redirect and a dropped connection are each 503 busy, with one call and no retry', async () => {
  for (const error of [new DOMException('timed out', 'TimeoutError'), new TypeError('redirect mode is set to error'), new TypeError('fetch failed')]) {
    const failing = vi.fn(async () => Promise.reject(error));
    const { res, body } = await run(request(), failing);
    expect([res.status, body]).toEqual([503, { error: 'busy' }]);
    expect(failing).toHaveBeenCalledTimes(1);
  }
});

test('11 the log line holds the status and milliseconds, never the message, token, address or upstream body', async () => {
  await run(request({ about: 'site', message: 'PRIVATE-WORDS' }));
  await run(request({ about: 'site', message: 'PRIVATE-WORDS' }), upstream(500, 'UPSTREAM-DETAIL'));
  await run(request({ about: 'site', message: 'PRIVATE-WORDS' }), vi.fn(async () => Promise.reject(new TypeError(`failed ${URL_} ${TOKEN}`))));
  const lines = vi.mocked(console.log).mock.calls.flat();
  expect(lines).toHaveLength(3);
  expect(lines.map((l) => Object.keys(JSON.parse(l)).sort())).toEqual(Array(3).fill(['feedback', 'ms', 'status']));
  expect(lines.map((l) => JSON.parse(l).status)).toEqual([200, 503, 503]);
  expect(lines.join(' ')).not.toMatch(/PRIVATE-WORDS|TOKEN-SECRET|SECRET-PATH|flow\.example|UPSTREAM-DETAIL/);
});
