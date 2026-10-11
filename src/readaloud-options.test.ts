// readaloud.ts's fill() must not touch the DOM when a rebuild would be identical (check:stillness: headless
// Chromium has no voices, so a late `voiceschanged` refill still produces just Emma, and that
// must not count as a change). fill() itself touches document/window at import time, so it is not reachable
// here; this tests the pure builder + comparator its no-op guard is built on instead.
import { expect, test } from 'vitest';
import { buildVoiceList, sameVoiceList } from './readaloud-options.ts';

const alex = { name: 'Alex', lang: 'en-US', voiceURI: 'Alex' };
const kyoko = { name: 'Kyoko', lang: 'ja-JP', voiceURI: 'Kyoko' };

test('1 no voices, twice, builds the same list (a repeat refill would be a no-op)', () => {
  const first = buildVoiceList([], undefined);
  const second = buildVoiceList([], undefined); // e.g. a second voiceschanged, still nothing installed
  expect(sameVoiceList(second, first)).toBe(true);
});

test('2 the same voices and the same choice, twice, build the same list', () => {
  const first = buildVoiceList([alex, kyoko], 'Kyoko');
  const second = buildVoiceList([alex, kyoko], 'Kyoko');
  expect(sameVoiceList(second, first)).toBe(true);
});

test('3 voices arriving after load build a different list, so the real update still happens', () => {
  const before = buildVoiceList([], undefined);
  const after = buildVoiceList([alex, kyoko], 'Kyoko'); // Chrome lists its voices after the page loads
  expect(sameVoiceList(after, before)).toBe(false);
});

test('4 the same voices with a different choice build a different list', () => {
  const first = buildVoiceList([alex, kyoko], 'Alex');
  const second = buildVoiceList([alex, kyoko], 'Kyoko');
  expect(sameVoiceList(second, first)).toBe(false);
});
