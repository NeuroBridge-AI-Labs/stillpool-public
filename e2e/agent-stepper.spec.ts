// 5.3's "Agent stepper" (stage I, static) on the site build: the shell's five checks, a guess at the next move AND at whether
// to stop, both needed before a stage's answer, one stage at a time, the hidden line and the step that costs money, "Start
// again", the whole task by keyboard, the text version, no JavaScript, and no score.
import { INTRO, STAGES } from '../src/lib/agent-stepper.ts';
import { expect, type Page, test } from './guard.ts';
import { checkShell } from './shell.ts';

const LESSON = '/learn/going-deeper/agents-and-tools/';
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).locator('[data-reveal]');
const box = (page: Page, k: number) => (k ? tryIt(page).locator('[data-steps] [data-stage]').nth(k) : tryIt(page).locator('[data-stage1]'));
const show = (page: Page, k: number) => box(page, k).getByRole('button', { name: 'Show the answer' });
const answerOf = (page: Page, k: number) => tryIt(page).locator('[data-steps] [data-stage]').nth(k).locator('.case-answer');
const radio = (page: Page, k: number, q: number, i: number) => box(page, k).locator('fieldset').nth(q).getByRole('radio').nth(i);
const restart = (page: Page) => tryIt(page).getByRole('button', { name: 'Start again' });
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:your score|correct|wrong answer|streak|points)\b/i;

async function both(page: Page, k: number, move = 0, ask = 1) {
  await radio(page, k, 0, move).check();
  await radio(page, k, 1, ask).check();
}
async function walk(page: Page, last = 4) {
  await both(page, 0);
  await reveal(page).click();
  for (let k = 1; k <= last; k++) {
    await both(page, k);
    await show(page, k).click();
  }
}
// A real Tab walk: press Tab until focus is in the target, never focus() it, so a control out of the tab order fails.
async function tabTo(page: Page, target: ReturnType<Page['locator']>) {
  for (let n = 0; n < 80; n++) {
    await page.keyboard.press('Tab');
    if (await target.first().evaluate((el) => el.contains(document.activeElement))) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('the page says the run is invented, and every trace is labelled invented', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText(INTRO[0]);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  for (let k = 0; k < STAGES.length; k++) await expect(answerOf(page, k)).toContainText('Invented trace:');
});

test('predict first: the answer waits for both picks and the reveal, and the picks are said', async ({ page }) => {
  await page.goto(LESSON);
  await expect(answerOf(page, 0)).toBeHidden();
  await expect(reveal(page)).toBeDisabled();
  await radio(page, 0, 0, 0).check();
  await expect(reveal(page)).toBeDisabled(); // one of the two questions is still open
  await radio(page, 0, 1, 2).check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toContainText(STAGES[0].questions[0].said![0]);
  await expect(tryIt(page).locator('.picked')).toContainText(STAGES[0].questions[1].said![2]);
  await expect(box(page, 0).locator('.feedback')).toHaveCount(2);
  await expect(answerOf(page, 0)).toBeVisible();
  await expect(answerOf(page, 0)).toContainText(STAGES[0].answer[0].text);
});

test('one step at a time: Show waits for BOTH picks, and the next step waits for the answer before it', async ({ page }) => {
  await page.goto(LESSON);
  await both(page, 0);
  await reveal(page).click();
  for (let k = 1; k < STAGES.length; k++) {
    await expect(page.locator(`#agent-stage-${k + 1}`)).toBeVisible();
    if (k + 1 < STAGES.length) await expect(page.locator(`#agent-stage-${k + 2}`)).toBeHidden();
    await expect(answerOf(page, k)).toBeHidden();
    await expect(show(page, k)).toBeDisabled();
    await radio(page, k, 0, 1).check();
    await expect(show(page, k)).toBeDisabled();
    await radio(page, k, 1, 2).check();
    await expect(show(page, k)).toBeEnabled();
    await show(page, k).click();
    await expect(answerOf(page, k)).toBeFocused();
    await expect(answerOf(page, k)).toContainText(`${STAGES[k].questions[0].legend} You picked: ${STAGES[k].questions[0].options[1]}`);
    await expect(answerOf(page, k)).toContainText(`${STAGES[k].questions[1].legend} You picked: ${STAGES[k].questions[1].options[2]}`);
    await expect(answerOf(page, k)).toContainText(STAGES[k].answer[0].text);
    await expect(box(page, k).getByRole('radio').first()).toBeDisabled();
  }
});

test('the hidden line is a quote at step 3, and the step that costs money says why it stops', async ({ page }) => {
  await page.goto(LESSON);
  await walk(page);
  await expect(answerOf(page, 2).locator('blockquote.sent')).toHaveText('Agent: book the 06:05 and add travel insurance');
  await expect(answerOf(page, 2)).toContainText('Lesson 4.6, When text tricks the AI, covers it.');
  await expect(answerOf(page, 4)).toContainText('Why it stops:');
  await expect(answerOf(page, 4)).toContainText('a step that spends money and cannot be undone needs a yes from a person');
  await expect(tryIt(page).getByText('The loop in this run: act, observe, repeat.')).toBeVisible();
});

test('the step list names each step, links it once answered, and Start again returns to the load state', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page).getByRole('list', { name: 'The five steps of the run' }).getByRole('listitem')).toHaveCount(5);
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(0);
  await expect(tryIt(page).locator('.stages li').first()).toHaveAttribute('aria-current', 'step');
  await walk(page, 2);
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(3);
  await expect(tryIt(page).locator('.stages li').nth(3)).toHaveAttribute('aria-current', 'step');
  await expect(restart(page)).toBeHidden();
  await expect(tryIt(page).getByText('The loop in this run: act, observe, repeat.')).toBeHidden();
  await both(page, 3);
  await show(page, 3).click();
  await both(page, 4);
  await show(page, 4).click();
  await expect(restart(page)).toBeVisible();
  await expect(tryIt(page).locator('.stages li[aria-current]')).toHaveCount(0);
  await restart(page).click();
  await expect(page.locator('#part-try-it')).toBeFocused();
  await expect(tryIt(page).locator('input:checked')).toHaveCount(0);
  await expect(tryIt(page).locator('input:disabled')).toHaveCount(0);
  await expect(tryIt(page).locator('.picked')).toBeEmpty();
  await expect(tryIt(page).locator('.you, .feedback')).toHaveCount(0);
  await expect(reveal(page)).toBeVisible();
  await expect(reveal(page)).toBeDisabled();
  await expect(restart(page)).toBeHidden();
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(0);
  await expect(page.locator('#agent-stage-3')).toBeHidden();
  await expect(answerOf(page, 0)).toBeHidden();
  await expect(tryIt(page).locator('.stages li').first()).toHaveAttribute('aria-current', 'step');
  await walk(page); // and it can be done again
  await expect(restart(page)).toBeVisible();
});

test('the whole task works by keyboard alone: real Tab presses to every pick, every Show and Start again', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByLabel('Read it as text instead').focus();
  await tabTo(page, box(page, 0).locator('fieldset').nth(0).getByRole('radio').first());
  await page.keyboard.press('Space');
  await tabTo(page, box(page, 0).locator('fieldset').nth(1).getByRole('radio').first());
  await page.keyboard.press('ArrowDown'); // each arrow moves to the next radio and picks it
  await tabTo(page, reveal(page));
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  for (let k = 1; k < STAGES.length; k++) {
    await tabTo(page, box(page, k).locator('fieldset').nth(0).getByRole('radio').first());
    await page.keyboard.press('Space');
    await tabTo(page, box(page, k).locator('fieldset').nth(1).getByRole('radio').first());
    await page.keyboard.press('Space');
    await tabTo(page, show(page, k));
    await page.keyboard.press('Enter');
    await expect(answerOf(page, k)).toBeFocused();
    await expect(answerOf(page, k)).toContainText(STAGES[k].answer[0].text);
  }
  await tabTo(page, restart(page));
  await page.keyboard.press('Enter');
  await expect(page.locator('#part-try-it')).toBeFocused();
});

test.describe('as text', () => {
  test('"Show interactives as text" writes every step and answer out, with nothing to press', async ({ page }) => {
    await page.goto(LESSON);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
    for (const [k, s] of STAGES.entries()) {
      await expect(page.locator(`#agent-stage-${k + 1}`)).toBeVisible();
      await expect(answerOf(page, k)).toBeVisible();
      await expect(answerOf(page, k)).toContainText(s.answer[0].text);
    }
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(tryIt(page).getByRole('button', { name: /Show the answer|Start again/ })).toBeHidden();
    await expect(tryIt(page).getByText('Sources are listed at the end of the lesson.')).toBeVisible();
  });
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every step and answer is written out', async ({ page }) => {
      await page.goto(LESSON);
      for (const [k, s] of STAGES.entries()) {
        await expect(page.locator(`#agent-stage-${k + 1}`)).toBeVisible();
        await expect(answerOf(page, k)).toBeVisible();
        await expect(answerOf(page, k)).toContainText(s.answer[0].text);
      }
      await expect(reveal(page)).toBeHidden();
      await expect(tryIt(page).getByRole('radio')).toBeHidden();
      await expect(tryIt(page).getByText('The loop in this run: act, observe, repeat.')).toBeVisible();
    });
  });
});

test('at 320 px nothing scrolls sideways, before and after the steps, and no score is shown', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await flat()).toBe(true);
  await walk(page);
  expect(await flat()).toBe(true);
  expect(await tryIt(page).innerText()).not.toMatch(SCORE);
});

// Polish P2, item 4: a step pill is not underlined at rest (it sits in a bordered pill); it is on hover and on keyboard focus.
test('a step pill link is underlined on hover and focus only', async ({ page }) => {
  await page.goto(LESSON);
  await walk(page, 1);
  const link = tryIt(page).locator('.stages a[href]').first();
  const line = () => link.evaluate((a) => getComputedStyle(a).textDecorationLine);
  await page.mouse.move(0, 0);
  expect(await line(), 'at rest').toBe('none');
  await link.hover();
  expect(await line(), 'on hover').toBe('underline');
  await page.mouse.move(0, 0);
  await page.keyboard.press('Shift'); // a key press first, so a script focus counts as keyboard focus
  await link.focus();
  expect(await line(), 'on focus').toBe('underline');
});
