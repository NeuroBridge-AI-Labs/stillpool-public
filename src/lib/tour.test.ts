import { expect, test } from 'vitest';
import { mayStart, type TourState } from './tour.ts';

const ok: TourState = { reduced: false, focus: false, inView: true, docVisible: true, userPaused: false };

test('the tour starts only when every condition allows it', () => {
  expect(mayStart(ok)).toBe(true);
  for (const off of [{ reduced: true }, { focus: true }, { inView: false }, { docVisible: false }, { userPaused: true }])
    expect(mayStart({ ...ok, ...off }), JSON.stringify(off)).toBe(false);
});
