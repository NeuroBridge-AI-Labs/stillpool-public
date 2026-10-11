// The feedback page's state model and its reading of a response (FB1).
import { expect, test } from 'vitest';
import { LINES, START, canSend, next, outcome } from './feedback.ts';

test('the page starts ready, and only a send leaves ready', () => {
  expect(START).toBe('ready');
  expect(next('ready', 'send')).toBe('sending');
  for (const event of ['ok', 'fail', 'edit'] as const) expect(next('ready', event)).toBe('ready');
});

test('sending ends in sent or error, and ignores a second send and an edit', () => {
  expect(next('sending', 'ok')).toBe('sent');
  expect(next('sending', 'fail')).toBe('error');
  expect(next('sending', 'send')).toBe('sending');
  expect(next('sending', 'edit')).toBe('sending');
  expect(canSend('sending')).toBe(false);
});

test('from sent and error, a send goes again and an edit goes back to ready', () => {
  for (const from of ['sent', 'error'] as const) {
    expect(canSend(from)).toBe(true);
    expect(next(from, 'send')).toBe('sending');
    expect(next(from, 'edit')).toBe('ready');
  }
});

test.each([
  [200, { ok: true }, 'sent'],
  [200, {}, 'error'],
  [200, null, 'error'],
  [429, 'Too many requests', 'limit'],
  [503, { error: 'closed' }, 'closed'],
  [503, { error: 'busy' }, 'error'],
  [400, { error: 'bad_request' }, 'error'],
  [413, { error: 'too_large' }, 'long'],
  [500, null, 'error'],
])('status %i with %j reads as %s', (status, body, kind) => {
  expect(outcome(status, body)).toBe(kind);
});

test('every line is calm: short, no U+2014', () => {
  for (const line of Object.values(LINES)) {
    expect(line).not.toContain(String.fromCharCode(0x2014));
    expect(line.split(/(?<=\.)\s/).every((s) => s.split(' ').length <= 20)).toBe(true);
  }
});
