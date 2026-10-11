// 4.3's "Will the detector flag it?" (stage II, engine + R-4.3) on the fixture build: the shared case checks, and what is special
// to this one: the pretend detector's rating in words (Joyce is in the book, so it alone is flagged), the pretend detector said
// to be pretend, no percentage, and the recorded part (summary, the two models, every run) waiting for the last answer.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { trigrams } from '../../src/lib/pretend-detector.ts';
import { detectorCases, OPTIONS } from '../../src/lib/will-the-detector-flag-it.ts';
import { recording } from '../../src/lesson-schema.ts';
import { answerOf, type Cases, caseChecks, choose, reveal, showFor, tryIt } from '../cases.ts';
import { expect, type Page, test } from '../guard.ts';

const LESSON = '/learn/using-ai-well/ai-detectors/';
const rec = recording.parse(JSON.parse(readFileSync('fixtures/recorded/R-4.3.json', 'utf8')));
const cases = detectorCases(rec, trigrams(readFileSync('data/training/dubliners.txt', 'utf8')));
const marks = (load(readFileSync('fixtures/recorded/recorded.yaml', 'utf8')) as Record<string, { marks: { note: string }[] }>)['R-4.3'].marks;
const c: Cases = {
  lesson: LESSON,
  picks: [OPTIONS[1], OPTIONS[0], OPTIONS[2], OPTIONS[1], OPTIONS[1], OPTIONS[0]],
  scenes: cases.map((x) => x.scene),
  answers: cases.map((x) => x.answer[1].text),
};
caseChecks(c);

const after = (page: Page) => page.locator('[data-detector-after]');
async function answerAll(page: Page, upTo = c.picks.length) {
  await choose(page, 0, c.picks[0], c);
  await reveal(page).click();
  for (let k = 1; k < upTo; k++) {
    await choose(page, k, c.picks[k], c);
    await showFor(page, k).click();
  }
}

test('the page says the detector is pretend, and a rating is words, never a percentage', async ({ page }) => {
  await page.goto(LESSON);
  await expect(tryIt(page)).toContainText('The detector below is pretend.');
  await answerAll(page);
  await expect(tryIt(page)).toContainText('What it flagged says something about this pretend detector, not about the texts or who wrote them.');
  expect(await tryIt(page).innerText()).not.toContain('%');
  expect(await after(page).innerText()).not.toContain('%');
});

test('only the Joyce passage, which is in the book, is flagged, and each rating gives its count in words', async ({ page }) => {
  await page.goto(LESSON);
  await answerAll(page);
  for (const [k, x] of cases.entries()) {
    await expect(answerOf(page, k)).toContainText(`The pretend detector said: ${x.answer[0].text}`);
    await expect(answerOf(page, k)).toContainText(k === 1 ? 'Rated very predictable, flagged.' : 'not flagged.');
  }
  await expect(answerOf(page, 1)).toContainText('72 pieces in 72 were seen in the book.');
  await expect(answerOf(page, 1)).toContainText('A flag does not show who wrote a text.');
});

test('the recorded part waits for the last answer, then shows the summary, both models and every run', async ({ page }) => {
  await page.goto(LESSON);
  await expect(after(page)).toBeHidden();
  await answerAll(page, c.picks.length - 1);
  await expect(after(page)).toBeHidden();
  await choose(page, 5, c.picks[5], c);
  await showFor(page, 5).click();
  await expect(after(page)).toBeVisible();
  await expect(after(page)).toContainText('Test fixture summary of R-4.3, first paragraph.');
  await expect(after(page).locator('.the-ais h4')).toHaveText(['Test fixture model A', 'Test fixture model B']);
  await after(page).locator('.all-runs summary').click();
  await expect(after(page).locator('.all-runs article')).toHaveCount(4);
  for (const m of marks) await expect(after(page)).toContainText(m.note);
});

test('as text, and without JavaScript, the recorded part is written out with every run open', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  await expect(after(page)).toBeVisible();
  await expect(after(page).locator('.all-runs article')).toHaveCount(4);
  await expect(after(page).locator('.all-runs article').first()).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the recorded part is written out with every run open', async ({ page }) => {
    await page.goto(LESSON);
    await expect(after(page)).toBeVisible();
    await expect(after(page).locator('.all-runs article').first()).toBeVisible();
    await expect(after(page)).toContainText('Test fixture summary of R-4.3');
  });
});
