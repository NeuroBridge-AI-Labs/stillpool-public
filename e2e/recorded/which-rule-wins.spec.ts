// 2.3's "Which rule wins?" (stage I, R-2.3) on the fixture build: the shared checks for the recorded part, and the
// ordering part by keyboard, in words, never scored.
import { RULES, START } from '../../src/lib/which-rule.ts';
import { expect, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/roles-and-ground-rules/';
const rec = fixture(3);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const PICKS = ['rule-1|It declined and gave notes.', 'rule-2|It rewrote the paragraph.'];
const part = (page: import('../guard.ts').Page) => page.locator('.rule-order');
const names = (page: import('../guard.ts').Page) => part(page).locator('.order-list > li > span').allTextContents();

p2Checks({
  lesson: LESSON, n: 3, picks: PICKS,
  before: ['Test fixture system rule'],
  after: [r('C', 'A', 1), r('C', 'B', 1)],
});

test('the ordering part waits for the reveal, and starts with no rule in its own place', async ({ page }) => {
  await page.goto(LESSON);
  await expect(part(page)).toBeHidden();
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
  await expect(part(page)).toBeVisible();
  await expect(part(page)).toContainText('This part was not recorded. No AI answered it.');
  expect(await names(page)).toEqual(START.map((id) => RULES[id].rule));
});

test('the order is set by buttons and by keyboard, the place is kept and said, and the check scores nothing', async ({ page }) => {
  await page.goto(LESSON);
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
  const up = (id: number) => part(page).getByRole('button', { name: `Move up: ${RULES[id].rule}`, exact: true });
  const said = part(page).locator('.order-said');
  await up(0).focus();
  await page.keyboard.press('Enter'); // harm rule: second to first
  await expect(up(0)).toBeFocused();
  await expect(said).toHaveText(`${RULES[0].rule} is now first.`);
  await expect(up(0)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(said).toHaveText(`${RULES[0].rule} is already first.`);
  for (const id of [1, 2, 3]) while ((await names(page)).indexOf(RULES[id].rule) > id) await up(id).click();
  expect(await names(page)).toEqual(RULES.map((x) => x.rule));
  await part(page).getByRole('button', { name: `Move down: ${RULES[3].rule}`, exact: true }).focus();
  await page.keyboard.press('Enter'); // aria-disabled: a press is answered in words, nothing moves
  await expect(said).toHaveText(`${RULES[3].rule} is already last.`);
  expect(await names(page)).toEqual(RULES.map((x) => x.rule));
  await expect(part(page).locator('.order-answer')).toBeHidden();
  await part(page).getByRole('button', { name: 'Show the order in the lesson' }).click();
  const answer = part(page).locator('.order-answer');
  await expect(answer).toBeFocused();
  for (const [id, x] of RULES.entries()) await expect(answer.locator(`li[data-id="${id}"]`)).toContainText(`${x.rule} ${x.reason} You put it here.`);
  expect(await answer.innerText()).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer)\b/i);
});

test('a different order is told in words, place by place', async ({ page }) => {
  await page.goto(LESSON);
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
  await part(page).getByRole('button', { name: 'Show the order in the lesson' }).click();
  const answer = part(page).locator('.order-answer');
  // START is [2, 0, 3, 1]: rule 0 is second, rule 1 fourth, rule 2 first, rule 3 third.
  for (const [id, said] of ['You put it second.', 'You put it fourth.', 'You put it first.', 'You put it third.'].entries()) await expect(answer.locator(`li[data-id="${id}"] .yours`)).toHaveText(said);
});

test('as text, the lesson order is written out with a reason each and there is nothing to press in the ordering part', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  await expect(part(page).locator('.order-play')).toBeHidden();
  await expect(part(page).locator('.order-answer')).toBeVisible();
  for (const x of RULES) await expect(part(page).locator('.order-answer')).toContainText(`${x.rule} ${x.reason}`);
});

test('at 390 px every button in the ordering part is at least 44 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(LESSON);
  for (const p of PICKS) await radio(page, p).check();
  await reveal(page).click();
  const small = await part(page).locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
  expect(small).toEqual([]);
  expect(await tryIt(page).evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
