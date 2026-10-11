// The practice lab page's state model (design sheet 5, lab-spec E): every row of the table, and what a response means.
import { expect, test } from 'vitest';
import { OFFLINE, START, TIMEOUT, canSend, lineFor, next, outcome, type LabEvent, type Name, type State } from './lab.ts';

const at = (name: Name, had = false): State => ({ name, had });
const go = (state: State, ...events: LabEvent[]) => events.reduce(next, state);
const reply = { ai_answer: 'a', worked: 'w', try_next: 't', why: 'y', example_prompt: null, note: null };

test('1 every load starts at idle, and only start leaves it', () => {
  expect(START).toEqual(at('idle'));
  expect(go(START, { type: 'start' })).toEqual(at('ready'));
  for (const type of ['send', 'ok', 'cancel', 'reset'] as const) expect(go(START, { type } as LabEvent)).toEqual(START);
  expect(go(START, { type: 'fail', kind: 'error' })).toEqual(START);
});

test('2 send from ready, answered, error or limit goes to sending, and keeps whether an answer is on screen', () => {
  for (const name of ['ready', 'answered', 'error', 'limit'] as const) expect(go(at(name, true), { type: 'send' })).toEqual(at('sending', true));
  expect(go(at('ready'), { type: 'send' })).toEqual(at('sending', false));
});

test('3 a second send while sending is ignored', () => {
  expect(go(at('sending', true), { type: 'send' })).toEqual(at('sending', true));
});

test('4 ok, and each failure, leave sending', () => {
  expect(go(at('sending'), { type: 'ok' })).toEqual(at('answered', true));
  expect(go(at('sending'), { type: 'fail', kind: 'limit' }).name).toBe('limit');
  expect(go(at('sending'), { type: 'fail', kind: 'closed' }).name).toBe('off');
  expect(go(at('sending'), { type: 'fail', kind: 'error' }).name).toBe('error');
});

test('5 cancel returns to ready, or to answered when an answer was on screen', () => {
  expect(go(at('sending', false), { type: 'cancel' })).toEqual(at('ready'));
  expect(go(at('sending', true), { type: 'cancel' })).toEqual(at('answered', true));
});

test('6 a reply that arrives after cancel changes nothing', () => {
  const cancelled = go(at('sending'), { type: 'cancel' });
  expect(go(cancelled, { type: 'ok' })).toEqual(cancelled);
  expect(go(cancelled, { type: 'fail', kind: 'closed' })).toEqual(cancelled);
});

test('7 reset clears the answer from answered, error or limit; off stays off', () => {
  for (const name of ['answered', 'error', 'limit'] as const) expect(go(at(name, true), { type: 'reset' })).toEqual(at('ready'));
  expect(go(at('off'), { type: 'send' })).toEqual(at('off'));
  expect(go(at('off'), { type: 'start' })).toEqual(at('off'));
});

test('7b closed after an answer drops the answer, and no event sends from off', () => {
  expect(go(at('sending', true), { type: 'fail', kind: 'closed' })).toEqual(at('off'));
  expect(canSend(at('off'))).toBe(false);
  expect(canSend(at('idle'))).toBe(false);
  expect(canSend(at('sending'))).toBe(false);
  for (const name of ['ready', 'answered', 'error', 'limit'] as const) expect(canSend(at(name))).toBe(true);
});

test('8 a page restored from the back button is idle again, from any state', () => {
  for (const name of ['ready', 'sending', 'answered', 'error', 'limit', 'off'] as const) expect(go(at(name, true), { type: 'restore' })).toEqual(START);
});

test('9 outcome: 200 with the six fields is ok, and the notes may be null or text', () => {
  expect(outcome(200, reply)).toEqual({ ok: true, reply });
  expect(outcome(200, { ...reply, note: 'n', example_prompt: 'e' })).toMatchObject({ ok: true });
});

test('10 outcome: 200 with an empty or malformed answer is an error with its own line', () => {
  expect(outcome(200, { ...reply, ai_answer: '' })).toMatchObject({ ok: false, kind: 'error', code: '200 empty' });
  expect(outcome(200, { ...reply, worked: 3 })).toMatchObject({ ok: false, kind: 'error', code: '200 shape' });
  expect(outcome(200, null)).toMatchObject({ ok: false, kind: 'error' });
});

test('11 outcome: 429 is the limit, whatever the body says', () => {
  expect(outcome(429, null)).toMatchObject({ ok: false, kind: 'limit' });
  expect(outcome(429, 'Too many requests')).toMatchObject({ ok: false, kind: 'limit' });
});

test('12 outcome: 503 closed is off; busy, 502, 504 and the refusals are errors with their code', () => {
  expect(outcome(503, { error: 'closed' })).toMatchObject({ ok: false, kind: 'closed' });
  expect(outcome(503, { error: 'busy' })).toMatchObject({ kind: 'error', code: '503 busy' });
  expect(outcome(503, null)).toMatchObject({ kind: 'error', code: '503' });
  expect(outcome(502, { error: 'bad_reply' })).toMatchObject({ kind: 'error', code: '502 bad_reply' });
  expect(outcome(504, { error: 'timeout' })).toMatchObject({ kind: 'error', code: '504 timeout' });
  expect(outcome(413, { error: 'too_large' })).toMatchObject({ kind: 'error', code: '413 too_large' });
});

test('13 offline and timeout are errors with their own codes', () => {
  expect([OFFLINE.code, TIMEOUT.code]).toEqual(['offline', 'timeout']);
});

test("14 outcome: the server's filtered 200 is an error that shows the safety line, with no code", () => {
  expect(outcome(200, { filtered: true })).toEqual({ ok: false, kind: 'filtered', code: 'filtered' });
  expect(lineFor('filtered')).toBe("The AI's safety filter stopped this prompt. Nothing was answered. Try a different prompt.");
});

test('15 every failure code has a short sentence that says what to do', () => {
  expect(lineFor('503 busy')).toBe('The AI is busy, or the lab has reached its limit for this month. Try again later.');
  expect(lineFor('504 timeout')).toMatch(/Wait a little/);
  expect(lineFor(OFFLINE.code)).toMatch(/Check your connection/);
  expect(lineFor('413 too_large')).toMatch(/Make it shorter/);
  expect(lineFor('502 bad_reply')).toMatch(/ress Send again/);
  expect(lineFor('403 forbidden')).toMatch(/ress Send again/);
});

test('16 filtered after an answer drops the answer and keeps the state a failure, so no old coaching shows', () => {
  expect(go(at('sending', true), { type: 'fail', kind: 'filtered' })).toEqual(at('error', false));
  expect(go(at('sending', true), { type: 'fail', kind: 'error' })).toEqual(at('error', true));
});
