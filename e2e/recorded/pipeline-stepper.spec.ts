// 5.1's "Pipeline stepper" (stage I, R-5.1) on the fixture build: the shell's five checks, predict then reveal, one stage at
// a time, the base and tuned runs only at stages 1 and 4, "Start again", every run with its mark, the text version.
import { readFileSync } from 'node:fs';
import { STAGES } from '../../src/lib/pipeline-stepper.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/going-deeper/how-a-chatbot-is-made/';
const rec = JSON.parse(readFileSync('fixtures/recorded/R-5.1.json', 'utf8'));
const OPTION = STAGES[0].questions[0].options[1];
const tryIt = (page: Page) => page.locator('[data-part="tryit"]');
const reveal = (page: Page) => tryIt(page).locator('[data-reveal]');
const box = (page: Page, k: number) => (k ? tryIt(page).locator('[data-steps] [data-stage]').nth(k) : tryIt(page).locator('[data-stage1]'));
const show = (page: Page, k: number) => box(page, k).getByRole('button', { name: 'Show the answer' });
const answerOf = (page: Page, k: number) => tryIt(page).locator('[data-steps] [data-stage]').nth(k).locator('[data-answer], .case-answer').first();
const inSlot = (page: Page, reply: string) => tryIt(page).locator('.runs-pair').getByText(reply, { exact: true });
const baseReply = rec.variants[0].runs[0].reply;
const tunedReply = rec.variants[1].runs[0].reply;
const listed = (page: Page) => tryIt(page).locator('.stages li');

async function walk(page: Page, last = 4) {
  await box(page, 0).getByRole('radio', { name: OPTION, exact: true }).check();
  await reveal(page).click();
  for (let k = 1; k <= last; k++) {
    await box(page, k).getByRole('radio', { name: OPTION, exact: true }).check();
    await show(page, k).click();
  }
}

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('predict first: the answer waits for the pick and the reveal, and the pick is said', async ({ page }) => {
  await page.goto(LESSON);
  await expect(reveal(page)).toBeDisabled();
  await expect(inSlot(page, baseReply)).toBeHidden();
  await box(page, 0).getByRole('radio', { name: OPTION, exact: true }).check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toContainText('You predicted that it answers the question.');
  await expect(box(page, 0).locator('.feedback')).toContainText('Your prediction');
  await expect(inSlot(page, baseReply)).toBeVisible();
  await expect(inSlot(page, tunedReply)).toBeHidden(); // the tuned run waits for stage 4
});

test('one stage at a time: each next stage waits for the answer before it, and its answer for its own pick', async ({ page }) => {
  await page.goto(LESSON);
  await box(page, 0).getByRole('radio', { name: OPTION, exact: true }).check();
  await reveal(page).click();
  for (let k = 1; k < STAGES.length; k++) {
    await expect(page.locator(`#pipeline-stage-${k + 1}`)).toBeVisible();
    if (k + 1 < STAGES.length) await expect(page.locator(`#pipeline-stage-${k + 2}`)).toBeHidden();
    await expect(answerOf(page, k)).toBeHidden();
    await expect(show(page, k)).toBeDisabled();
    await box(page, k).getByRole('radio', { name: OPTION, exact: true }).check();
    await expect(show(page, k)).toBeEnabled();
    await show(page, k).click();
    await expect(answerOf(page, k)).toBeFocused();
    await expect(answerOf(page, k)).toContainText(`You picked: ${OPTION}`);
    await expect(answerOf(page, k)).toContainText(STAGES[k].answer[0].text);
    await expect(box(page, k).getByRole('radio', { name: OPTION, exact: true })).toBeDisabled();
  }
});

test('runs show only at stages 1 and 4, with the model, the day and every stored setting', async ({ page }) => {
  await page.goto(LESSON);
  await walk(page, 2);
  await expect(inSlot(page, tunedReply)).toBeHidden();
  await expect(answerOf(page, 2).locator('.run')).toHaveCount(0);
  await box(page, 3).getByRole('radio', { name: OPTION, exact: true }).check();
  await show(page, 3).click();
  await expect(inSlot(page, tunedReply)).toBeVisible();
  await expect(answerOf(page, 0)).toContainText(rec.variants[0].model.name);
  await expect(answerOf(page, 0)).toContainText('Recorded on 1 January 2000');
  await expect(answerOf(page, 0)).toContainText('Longest answer, in tokens: 80; the base model was stopped here');
  await expect(answerOf(page, 0)).toContainText('chat template: none: the text was sent raw');
  await expect(answerOf(page, 3)).toContainText(rec.variants[1].model.name);
  await expect(answerOf(page, 3)).toContainText('chat template: Test fixture template');
  await answerOf(page, 0).getByRole('button', { name: 'Show another run' }).click();
  await expect(answerOf(page, 0).getByText(rec.variants[0].runs[1].reply, { exact: true })).toBeVisible();
});

test('the stage list links a stage only once its answer is shown, and marks the current one', async ({ page }) => {
  await page.goto(LESSON);
  await expect(listed(page)).toHaveCount(5);
  await expect(tryIt(page).getByRole('list', { name: 'The five stages' })).toBeVisible();
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(0);
  await expect(listed(page).nth(0)).toHaveAttribute('aria-current', 'step');
  await walk(page, 1);
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(2);
  await expect(listed(page).nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(listed(page).nth(0)).not.toHaveAttribute('aria-current', /.*/);
});

test('after the last stage the summary, every run and Start again appear, and Start again returns to the load state', async ({ page }) => {
  await page.goto(LESSON);
  const restart = tryIt(page).getByRole('button', { name: 'Start again' });
  await walk(page, 3);
  await expect(restart).toBeHidden();
  await expect(tryIt(page).getByText('Test fixture summary of R-5.1, first paragraph.')).toBeHidden();
  await box(page, 4).getByRole('radio', { name: OPTION, exact: true }).check();
  await show(page, 4).click();
  await expect(restart).toBeVisible();
  await expect(tryIt(page).getByText('Test fixture summary of R-5.1, first paragraph.')).toBeVisible();
  await expect(tryIt(page).getByText('A base model continues a text. Tuning makes it answer.')).toBeVisible();
  await restart.click();
  await expect(page.locator('#part-try-it')).toBeFocused();
  await expect(tryIt(page).locator('input:checked')).toHaveCount(0);
  await expect(tryIt(page).locator('input:disabled')).toHaveCount(0);
  await expect(tryIt(page).locator('.picked')).toBeEmpty();
  await expect(tryIt(page).locator('.you, .feedback')).toHaveCount(0);
  await expect(reveal(page)).toBeVisible();
  await expect(reveal(page)).toBeDisabled();
  await expect(restart).toBeHidden();
  await expect(tryIt(page).locator('.stages a[href]')).toHaveCount(0);
  await expect(page.locator('#pipeline-stage-3')).toBeHidden();
  await expect(inSlot(page, baseReply)).toBeHidden();
  await expect(tryIt(page).getByText('Test fixture summary of R-5.1, first paragraph.')).toBeHidden();
  await expect(listed(page).nth(0)).toHaveAttribute('aria-current', 'step');
  await walk(page); // and it can be done again
  await expect(restart).toBeVisible();
});

test('"Show all runs" holds every run under its label, each mark, and the false piece highlighted', async ({ page }) => {
  await page.goto(LESSON);
  await walk(page);
  const all = tryIt(page).locator('.all-runs');
  await all.locator('summary').focus();
  await page.keyboard.press('Enter');
  const keys = ['BASE|A|1', 'BASE|A|2', 'BASE|A|3', 'TUNED|B|1', 'TUNED|B|2', 'TUNED|B|3'];
  expect(await all.locator('[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))).toEqual(keys);
  for (const [v, variant] of rec.variants.entries())
    for (const [i, run] of variant.runs.entries()) {
      const card = all.locator(`[data-key="${keys[v * 3 + i]}"]`);
      await expect(card).toContainText(run.reply.replace('a false piece', ''));
      await expect(card).toContainText(`Test fixture note ${v ? 'TUNED' : 'BASE'} run ${i + 1}.`);
    }
  await expect(all.locator('mark')).toHaveText(['a false piece']);
  await expect(all.locator('.note.bad')).toContainText('Not true: Test fixture reason BASE run 1.');
  await expect(all.locator('h3')).toHaveText([rec.variants[0].model.name, rec.variants[1].model.name]);
});

test.describe('as text', () => {
  const texted = async (page: Page) => {
    await page.goto(LESSON);
    await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
    await page.reload();
  };
  test('"Show interactives as text" writes every stage, answer and run out, with nothing to press', async ({ page }) => {
    await texted(page);
    for (const [k, s] of STAGES.entries()) {
      await expect(page.locator(`#pipeline-stage-${k + 1}`)).toBeVisible();
      if (k) await expect(answerOf(page, k)).toContainText(s.answer[0].text);
    }
    await expect(answerOf(page, 0)).toContainText(STAGES[0].answer[0].text);
    for (const reply of [baseReply, tunedReply]) await expect(tryIt(page).locator('.all-runs').getByText(reply.replace('a false piece', ''), { exact: false }).first()).toBeVisible();
    await expect(tryIt(page).getByText('Test fixture summary of R-5.1, first paragraph.')).toBeVisible();
    await expect(tryIt(page).getByRole('radio')).toBeHidden();
    await expect(tryIt(page).getByRole('button', { name: /Show the answer|Start again|Show another run/ })).toBeHidden();
  });
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every stage, answer and run is written out', async ({ page }) => {
      await page.goto(LESSON);
      for (const [k, s] of STAGES.entries()) {
        await expect(page.locator(`#pipeline-stage-${k + 1}`)).toBeVisible();
        await expect(answerOf(page, k)).toContainText(s.answer[0].text);
        await expect(answerOf(page, k)).toBeVisible();
      }
      await expect(tryIt(page).locator('.all-runs [data-key]')).toHaveCount(6);
      await expect(tryIt(page).locator('.all-runs')).toContainText(tunedReply);
      await expect(reveal(page)).toBeHidden();
      await expect(tryIt(page).getByRole('radio')).toBeHidden();
    });
  });
});

test('at 320 px nothing scrolls sideways, before and after the stages, and no score is shown', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  const flat = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await flat()).toBe(true);
  await walk(page);
  expect(await flat()).toBe(true);
  expect(await tryIt(page).innerText()).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:your score|correct|wrong answer|streak|points)\b/i);
});
