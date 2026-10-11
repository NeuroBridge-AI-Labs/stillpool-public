// 5.5's "Find, then answer" (stage I, an engine and R-5.5) on the fixture build: the shell's five checks, predict first,
// the five closest entries worked out from the committed vectors, one question at a time, "Try another question", the
// recorded answers behind "Show all runs", and the text and no-JavaScript versions.
import { readFileSync } from 'node:fs';
import { inWords, rank } from '../../src/lib/find-then-answer.ts';
import { ABOUT, firstMatch } from '../../src/lib/find-then-answer-words.ts';
import { expect, type Page, test } from '../guard.ts';
import { allRuns, checkEvery, fixture, reply, tryIt } from '../p2.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/going-deeper/answers-from-your-documents/';
type Data = { entries: { term: string; lesson: string; title: string; vector: number[] }[]; questions: { id: string; text: string; vector: number[] }[] };
const data = JSON.parse(readFileSync('data/interactive/glossary-vectors.json', 'utf8')) as Data;
const rec = fixture('R-5.5');
const r = (l: string, m: 'A' | 'B') => reply(rec, l, m, 1);
const SCORE = /%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer|streak)\b|\d points/i;

const reveal = (page: Page) => tryIt(page).getByRole('button', { name: 'Show what it found' });
const again = (page: Page) => tryIt(page).getByRole('button', { name: 'Try another question' });
const block = (page: Page, id: string) => tryIt(page).locator(`[data-q="${id}"]`);
const radio = (page: Page, group: string, name: string) => tryIt(page).locator(`label:has(input[name="${group}"])`).filter({ hasText: new RegExp(`^${name}$`) }).getByRole('radio');
const pick = async (page: Page, q: string, first = 'Yes', stay = 'Yes') => {
  await tryIt(page).getByLabel('Your question').selectOption({ label: q });
  await radio(page, 'fta-first', first).check();
  await radio(page, 'fta-stay', stay).check();
};
const lines = (i: number) => rank(data.questions[i].vector, data.entries).map((m) => `${m.term}, from the lesson "${data.entries.find((e) => e.term === m.term && e.lesson === m.lesson)!.title}": ${inWords(m.similarity)}`);

test("the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('predict first: nothing is found until all three picks and the reveal; then only the picked question shows, and the picks are said in words', async ({ page }) => {
  await page.goto(LESSON);
  await expect(reveal(page)).toBeDisabled();
  for (const q of data.questions) await expect(block(page, q.id)).toBeHidden();
  await tryIt(page).getByLabel('Your question').selectOption({ label: data.questions[6].text });
  await radio(page, 'fta-first', 'Yes').check();
  await expect(reveal(page)).toBeDisabled();
  await radio(page, 'fta-stay', "Can't tell").check();
  await expect(reveal(page)).toBeEnabled();
  await reveal(page).click();
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(tryIt(page).locator('.picked')).toHaveText(`You picked: ${data.questions[6].text}\nYou predicted the first match: yes.\nYou predicted both answers will stay inside the passages: can't tell.`);
  await expect(block(page, 'Q7')).toBeVisible();
  for (const q of data.questions.filter((x) => x.id !== 'Q7')) await expect(block(page, q.id)).toBeHidden();
});

for (const [i, q] of data.questions.entries()) {
  test(`${q.id}: the five closest entries, in words, and our reading of the first match`, async ({ page }) => {
    await page.goto(LESSON);
    await pick(page, q.text);
    await reveal(page).click();
    expect(await block(page, q.id).locator('ol').first().locator('li').allTextContents()).toEqual(lines(i));
    await expect(block(page, q.id)).toContainText(`Our reading: ${firstMatch(q.vector, data.entries, ABOUT[i], rank(q.vector, data.entries)[0])}`);
    const text = await block(page, q.id).innerText();
    expect(text).not.toMatch(SCORE);
    expect(text).not.toMatch(/\b\d\.\d\d\b/); // the raw cosine is in the Deep layer only
  });
}

test('known results of the committed glossary lists: deployer is very close for question 7, and question 8 finds five entries, none close', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[6].text);
  await reveal(page).click();
  await expect(block(page, 'Q7').locator('ol').first().locator('li').first()).toHaveText('deployer, from the lesson "The law: AI rules in Ireland and the EU": very close');
  await page.reload();
  await pick(page, data.questions[7].text, 'No');
  await reveal(page).click();
  const five = await block(page, 'Q8').locator('ol').first().locator('li').allTextContents();
  expect(five).toHaveLength(5);
  for (const l of five) expect(l.endsWith(': not close')).toBe(true);
  await expect(block(page, 'Q8')).toContainText('The snapshot of the glossary has no entry for fine-tuning.');
});

// A real Tab walk: press Tab until focus is in the target, never focus() it, so a control out of the tab order fails.
async function tabTo(page: Page, target: ReturnType<Page['locator']>) {
  for (let n = 0; n < 80; n++) {
    await page.keyboard.press('Tab');
    if (await target.first().evaluate((el) => el.contains(document.activeElement))) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test('the whole task works by keyboard alone: real Tab presses to every control, including Try another question', async ({ page }) => {
  await page.goto(LESSON);
  await tryIt(page).getByLabel('Read it as text instead').focus();
  await tabTo(page, tryIt(page).getByLabel('Your question'));
  await page.keyboard.type('What is a'); // type-ahead picks Q1: the arrow keys only open the list on a Mac
  await expect(tryIt(page).getByLabel('Your question')).toHaveValue('Q1');
  await tabTo(page, tryIt(page).locator('input[name="fta-first"]'));
  await page.keyboard.press('Space'); // the first radio, Yes
  await tabTo(page, tryIt(page).locator('input[name="fta-stay"]'));
  await page.keyboard.press('ArrowDown'); // an arrow moves to the next radio and picks it: No
  await tabTo(page, reveal(page));
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('.picked')).toBeFocused();
  await expect(block(page, 'Q1')).toBeVisible();
  await tabTo(page, again(page));
  await page.keyboard.press('Enter');
  await expect(tryIt(page).locator('[data-first]')).toBeFocused();
});

test('Try another question clears the picks and the result, and the next question shows alone', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  await again(page).click();
  await expect(tryIt(page).getByLabel('Your question')).toHaveValue('');
  await expect(tryIt(page).getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(tryIt(page).locator('.picked')).toBeEmpty();
  await expect(tryIt(page).locator('.feedback')).toHaveCount(0);
  await expect(reveal(page)).toBeDisabled();
  await expect(tryIt(page).locator('[data-first]')).toBeFocused();
  for (const q of data.questions) await expect(block(page, q.id)).toBeHidden();
  await pick(page, data.questions[2].text, 'No', 'No');
  await reveal(page).click();
  await expect(block(page, 'Q3')).toBeVisible();
  await expect(block(page, 'Q1')).toBeHidden();
  await expect(tryIt(page).locator('.picked')).toContainText(`You picked: ${data.questions[2].text}`);
});

test('the picks cannot change after the reveal, so the result and the words stay together', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  await expect(tryIt(page).getByLabel('Your question')).toBeDisabled();
  await expect(radio(page, 'fta-first', 'No')).toBeDisabled();
});

test('the recorded part: the summary, both models and the day, every stored setting, one run from each model for the picked question', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  const said = await tryIt(page).innerText();
  for (const t of ['Test fixture summary of R-5.5, first paragraph.', rec.model.name, 'Test fixture model B', 'Recorded on 1 January 2000', 'Longest answer, in tokens: 4000', 'Lists made 9 October 2026 with nomic-embed-text, for a snapshot of the glossary: 159 entries from the first 25 lessons. Nothing is counted or saved.', 'A close match is not a right answer. Check the answer against the passage it points to.'])
    expect(said).toContain(t);
  expect(said.match(SCORE)).toBeNull();
  const pair = block(page, 'Q1').locator('.runs-pair');
  await expect(pair.getByText(r('Q1', 'A').trim(), { exact: true })).toBeVisible();
  await expect(pair.locator('mark')).toHaveText('Test fixture altered piece.');
  await expect(pair.getByText('Test fixture note Q1 B.')).toBeVisible();
  await expect(block(page, 'Q1')).toContainText('Our reading, Test fixture model A: Yes.');
  await expect(block(page, 'Q1')).toContainText('Our reading, Test fixture model B: No.');
});

test('"Show all runs" holds every recorded run of all eight questions, with its marks', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  await allRuns(page).locator('summary').focus();
  await page.keyboard.press('Enter');
  await checkEvery(page, 'R-5.5');
  expect(await allRuns(page).locator('h3').allTextContents()).toEqual(data.questions.map((q, i) => `Question ${i + 1}: ${q.text}`));
});

test('as text, all eight results are written out with nothing to press', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  await expect(reveal(page)).toBeHidden();
  await expect(tryIt(page).getByLabel('Your question')).toBeHidden();
  await expect(again(page)).toBeHidden();
  for (const [i, q] of data.questions.entries()) {
    await expect(block(page, q.id)).toBeVisible();
    expect(await block(page, q.id).locator('ol').first().locator('li').allTextContents()).toEqual(lines(i));
  }
  await checkEvery(page, 'R-5.5');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all eight results and the full list of runs are written out', async ({ page }) => {
    await page.goto(LESSON);
    for (const [i, q] of data.questions.entries()) {
      await expect(block(page, q.id)).toBeVisible();
      expect(await block(page, q.id).locator('ol').first().locator('li').allTextContents()).toEqual(lines(i));
    }
    await checkEvery(page, 'R-5.5');
  });
});

test('the raw cosine is in the Deep layer only, to two places', async ({ page }) => {
  await page.goto(LESSON);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  await expect(block(page, 'Q1').locator('details[data-layer="deep"]')).toBeHidden();
  await page.goto(`${LESSON}?depth=deep`);
  await pick(page, data.questions[0].text);
  await reveal(page).click();
  const deep = block(page, 'Q1').locator('details[data-layer="deep"]');
  await deep.locator('summary').click();
  const want = rank(data.questions[0].vector, data.entries).map((m) => `${m.term}: ${m.similarity.toFixed(2)}`);
  expect(await deep.locator('ol li').allTextContents()).toEqual(want);
});

test('at 320 px nothing scrolls sideways and the controls are 44 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(LESSON);
  await pick(page, data.questions[2].text);
  await reveal(page).click();
  const wide = await page.evaluate(() => [...document.querySelectorAll('.find-then-answer *')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().right > innerWidth).length);
  expect(wide).toBe(0);
  const small = await tryIt(page).locator('button, select').evaluateAll((els) => els.filter((e) => e.checkVisibility() && e.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
});
