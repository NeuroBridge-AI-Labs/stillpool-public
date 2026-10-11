// NBL1, the save code (D8). 42 finished bits, then 42 badge bits, packed most significant bit first into 11 bytes;
// CRC-16/CCITT-FALSE over those bytes; 84 + 16 = 100 bits as 20 Crockford base32 symbols, NBL1-XXXX-XXXX-XXXX-XXXX-XXXX.
import { SIZE, SLOTS } from './slots.ts';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const MESSAGES = {
  notACode: 'This is not a save code. A save code starts with NBL1.',
  version: 'This save code is from a different version of this site, so it cannot be read here.',
  shape: 'This save code has the wrong length, or a letter that cannot be in a save code. Check it and try again.',
  check: 'This save code does not check out. One letter may be mistyped. Check it and try again.',
};
type Found = { finished: string[]; badges: string[] };

export const crc16 = (bytes: number[]) => {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
};
const bytesOf = (bits: number[]) =>
  Array.from({ length: Math.ceil(bits.length / 8) }, (_, i) => bits.slice(i * 8, i * 8 + 8).reduce((b, bit, j) => b | (bit << (7 - j)), 0));

// slots is a parameter only so the tests can fill all 42.
export function encode({ finished, badges }: Found, slots = SLOTS) {
  const payload = [finished, badges].flatMap((ids) => Array.from({ length: SIZE }, (_, i) => Number(ids.includes(slots[i]))));
  const crc = crc16(bytesOf(payload));
  const bits = [...payload, ...Array.from({ length: 16 }, (_, i) => (crc >> (15 - i)) & 1)];
  const symbols = Array.from({ length: 20 }, (_, i) => ALPHABET[bits.slice(i * 5, i * 5 + 5).reduce((v, bit) => v * 2 + bit, 0)]);
  return `NBL1-${symbols.join('').match(/.{4}/g)?.join('-')}`;
}

export function decode(typed: string, slots = SLOTS): ({ ok: true } & Found) | { ok: false; message: string } {
  // A pasted restore link counts as its code, on any line; any dash counts as a hyphen (pr7-review NICE 4).
  const text = typed.replace(/^[\s\S]*#p=/, '').toUpperCase().replace(/[\s\p{Pd}]/gu, '');
  if (!text.startsWith('NBL')) return { ok: false, message: MESSAGES.notACode };
  // People misread I and L as 1 and O as 0, in the version character too (F17).
  const rest = text.slice(3).replace(/[IL]/g, '1').replace(/O/g, '0');
  // Only a letter or digit can be a version (pr7-review NICE 2).
  if (rest && rest[0] !== '1') return { ok: false, message: /[A-Z0-9]/.test(rest[0]) ? MESSAGES.version : MESSAGES.shape };
  const symbols = rest.slice(1);
  if (symbols.length !== 20 || [...symbols].some((c) => !ALPHABET.includes(c))) return { ok: false, message: MESSAGES.shape };
  const bits = [...symbols].flatMap((c) => Array.from({ length: 5 }, (_, i) => (ALPHABET.indexOf(c) >> (4 - i)) & 1));
  const crc = bits.slice(84).reduce((v, bit) => v * 2 + bit, 0);
  if (crc !== crc16(bytesOf(bits.slice(0, 84)))) return { ok: false, message: MESSAGES.check };
  // A slot this version does not know yet (a newer site's lesson) is left out.
  const ids = (from: number) => slots.filter((_, i) => i < SIZE && bits[from + i] === 1);
  return { ok: true, finished: ids(0), badges: ids(SIZE) };
}
