// NBL1, the save code (plan T7.3, D8): the CRC, the pinned vectors, round trips, typing slack and every refusal.
import { globSync } from 'node:fs';
import { expect, test } from 'vitest';
import { crc16, decode, encode, MESSAGES } from './code.ts';
import { SIZE, SLOTS } from './slots.ts';

const SLOT0 = SLOTS[0];
const ALL = SLOTS.concat(Array.from({ length: SIZE - SLOTS.length }, (_, i) => `future/${i}`));

test('1 CRC-16/CCITT-FALSE of "123456789" is 0x29B1', () => {
  expect(crc16([...new TextEncoder().encode('123456789')])).toBe(0x29b1);
});

test('2 empty progress encodes to NBL1-0000-0000-0000-0000-1N0F', () => {
  expect(encode({ finished: [], badges: [] })).toBe('NBL1-0000-0000-0000-0000-1N0F');
});

test('3 the other three D8 vectors', () => {
  expect(encode({ finished: [SLOT0], badges: [SLOT0] })).toBe('NBL1-G000-0000-4000-0000-0T5D');
  expect(encode({ finished: [SLOT0], badges: [] })).toBe('NBL1-G000-0000-0000-0000-0QD5');
  expect(encode({ finished: ALL, badges: ALL }, ALL)).toBe('NBL1-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZPSK');
});

test('4 100 seeded random sets round-trip', () => {
  let seed = 42;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let n = 0; n < 100; n++) {
    const pick = () => ALL.filter(() => random() < 0.5);
    const set = { finished: pick(), badges: pick() };
    expect(decode(encode(set, ALL), ALL)).toEqual({ ok: true, ...set });
  }
});

test('5 the typed nbll g000 oooo 4ooo oooo ot5d is slot 0 finished and badged', () => {
  expect(decode('nbll g000 oooo 4ooo oooo ot5d')).toEqual({ ok: true, finished: [SLOT0], badges: [SLOT0] });
  // The restore link pasted whole, as the save-code block shows it (self-review NICE 1).
  expect(decode('https://example.org/#p=NBL1-G000-0000-4000-0000-0T5D')).toEqual({ ok: true, finished: [SLOT0], badges: [SLOT0] });
  // pr7-review NICE 4: the link on a second line, and hyphens a word processor made into en dashes.
  expect(decode('My code:\nhttps://example.org/#p=NBL1-G000-0000-4000-0000-0T5D')).toEqual({ ok: true, finished: [SLOT0], badges: [SLOT0] });
  expect(decode('NBL1\u2013G000\u20130000\u20134000\u20130000\u20130T5D')).toEqual({ ok: true, finished: [SLOT0], badges: [SLOT0] });
});

test('6 all 620 single-symbol substitutions of NBL1-G000-0000-4000-0000-0T5D are refused', () => {
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const code = 'G000-0000-4000-0000-0T5D'.replaceAll('-', '');
  let refused = 0;
  for (let i = 0; i < 20; i++)
    for (const c of ALPHABET)
      if (c !== code[i]) {
        const typo = code.slice(0, i) + c + code.slice(i + 1);
        const r = decode(`NBL1${typo}`);
        expect(r, typo).toEqual({ ok: false, message: MESSAGES.check });
        refused++;
      }
  expect(refused).toBe(620);
});

test('7 each refusal gives its plain message', () => {
  expect(decode('NBL2-G000-0000-4000-0000-0T5D')).toEqual({ ok: false, message: MESSAGES.version });
  expect(decode('NBL!-G000-0000-4000-0000-0T5D'), 'only a letter or digit can be a version').toEqual({ ok: false, message: MESSAGES.shape });
  expect(decode('hello')).toEqual({ ok: false, message: MESSAGES.notACode });
  expect(decode('NBL1-G000-0000-4000-0000-0T5')).toEqual({ ok: false, message: MESSAGES.shape });
  expect(decode('NBL1-G000-0000-4000-0000-0T5U')).toEqual({ ok: false, message: MESSAGES.shape });
});

test('8 every lesson in content has a slot, slots are unique, 42 at most', () => {
  const lessons = globSync('content/*/*/index.mdx').map((f) => f.split('/').slice(1, 3).join('/'));
  expect(lessons.length).toBeGreaterThan(0);
  for (const id of lessons) expect(SLOTS, id).toContain(id);
  expect(new Set(SLOTS).size).toBe(SLOTS.length);
  expect(SLOTS.length).toBeLessThanOrEqual(SIZE);
});
