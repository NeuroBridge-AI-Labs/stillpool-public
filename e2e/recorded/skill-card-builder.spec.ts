// 2.7's "Skill card builder" (stage I, R-2.7) on the fixture build: the shared checks with four strong picks, and what a
// weak pick does: a card we did not run, with only the no-card runs shown, as "no card".
import { cardText, FIELDS } from '../../src/lib/skill-card.ts';
import { expect, type Page, test } from '../guard.ts';
import { fixture, p2Checks, radio, reply, reveal, tryIt } from '../p2.ts';

const LESSON = '/learn/prompting/a-skill-is-a-written-procedure/';
const rec = fixture(7);
const r = (l: string, m: 'A' | 'B', n: number) => reply(rec, l, m, n);
const STRONG = FIELDS.map((f, i) => `card-${i + 1}|Strong: ${f.strong}`);
const SAME = 'card-same|Yes, the same three headings.';
// 7d point 9: the live message is short and points at the local feedback; the picks are shown beside what they answer.
const LIVE = 'Your prediction and what happened are above, under its question. Your card is below.';
const feedback = (page: Page) => tryIt(page).locator('fieldset:has(input[name="card-same"]) .feedback');
const ran = (page: Page) => tryIt(page).locator('.card-ran');
const notRun = (page: Page) => tryIt(page).locator('.card-not-run');
const open = async (page: Page, picks: string[]) => {
  await page.goto(LESSON);
  for (const p of [...picks, SAME]) await radio(page, p).check();
  await reveal(page).click();
};

p2Checks({
  lesson: LESSON, n: 7, picks: [...STRONG, SAME],
  before: ['Test fixture transcript 1'],
  after: [r('T1 B', 'A', 1), r('T2 A', 'A', 1)],
  said: LIVE,
});

test('four strong picks are the card we ran, shown with its runs beside the runs with no card', async ({ page }) => {
  await open(page, STRONG);
  await expect(ran(page)).toBeVisible();
  await expect(notRun(page)).toBeHidden();
  await expect(tryIt(page).locator('.your-card')).toContainText(cardText(FIELDS.map(() => 'strong')));
  await expect(ran(page).locator('blockquote')).toHaveText(cardText(FIELDS.map(() => 'strong')));
  await expect(ran(page).getByText('With the card').first()).toBeVisible();
  await expect(ran(page).getByText('No card', { exact: true }).first()).toBeVisible();
  await expect(ran(page).getByText(r('T1 B', 'A', 1), { exact: true })).toBeVisible();
  await expect(ran(page).getByText(r('T1 A', 'A', 1), { exact: true })).toBeVisible();
  await expect(tryIt(page).locator('.picked')).toHaveText(LIVE);
  await expect(tryIt(page).locator('.your-card')).toContainText(FIELDS[1].strong);
});

for (const [at, f] of FIELDS.entries()) {
  test(`a weak pick for ${f.name} says we did not run the card, and shows only the runs with no card`, async ({ page }) => {
    await open(page, STRONG.map((s, i) => (i === at ? `card-${i + 1}|Weak: ${f.weak}` : s)));
    await expect(notRun(page)).toBeVisible();
    await expect(ran(page)).toBeHidden();
    await expect(notRun(page)).toContainText('We did not run this card. No AI answered it.');
    await expect(tryIt(page).locator('.your-card')).toContainText(f.weak);
    await expect(notRun(page).getByText('No card, transcript 1').first()).toBeVisible();
    await expect(notRun(page).getByText(r('T1 A', 'A', 1), { exact: true })).toBeVisible();
    await expect(notRun(page).getByText(r('T1 B', 'A', 1), { exact: true })).toHaveCount(0);
    expect(await tryIt(page).locator('.card-not-run').innerText()).not.toMatch(/weak card|your card/i);
    await expect(tryIt(page).locator('.picked')).toHaveText(LIVE);
  });
}

test('changing a pick after the reveal changes what is shown, and a marked run keeps its mark', async ({ page }) => {
  await open(page, STRONG);
  await radio(page, `card-2|Weak: ${FIELDS[1].weak}`).check();
  await expect(notRun(page)).toBeVisible();
  await expect(ran(page)).toBeHidden();
  await expect(notRun(page).locator('mark')).toHaveText('Test fixture false claim');
  await expect(notRun(page).locator('mark').locator('xpath=ancestor::article[1]')).toContainText('Not true: Test fixture reason.');
  await radio(page, `card-2|Strong: ${FIELDS[1].strong}`).check();
  await expect(ran(page)).toBeVisible();
  await expect(notRun(page)).toBeHidden();
});

test('as text, the card we ran and the card we did not run are both written out, under their own headings', async ({ page }) => {
  await page.goto(LESSON);
  await page.evaluate(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await page.reload();
  await expect(ran(page)).toBeVisible();
  await expect(notRun(page)).toBeVisible();
  await expect(tryIt(page).getByRole('heading', { name: 'If any pick is weak: a card we did not run' })).toBeVisible();
  await expect(tryIt(page).locator('.your-card')).toBeHidden();
});

// Fix round 1 (S5): the prediction is shown beside its question whatever was picked, with an outcome only where the recording
// gives one, and the long live message no longer repeats the card.
for (const [pick, outcome] of [['Yes, the same three headings.', undefined], ['No, the headings will differ.', undefined], ["I can't tell.", 'Feedback. That is fair.']] as const)
  test(`"${pick}" shows the prediction beside its question${outcome ? ' with its feedback' : ' and no outcome'}`, async ({ page }) => {
    await open(page, STRONG);
    await radio(page, `card-same|${pick}`).check();
    await expect(feedback(page)).toHaveCount(1);
    await expect(feedback(page).locator('p').first()).toHaveText(`Your prediction. ${pick}`);
    await expect(feedback(page).locator('p')).toHaveCount(outcome ? 2 : 1);
    if (outcome) await expect(feedback(page).locator('p').nth(1)).toHaveText(outcome);
    await expect(tryIt(page).locator('.picked')).toHaveText(LIVE);
  });

test('a mixed card keeps the prediction feedback, and the build fields get none of their own', async ({ page }) => {
  await open(page, STRONG.map((s, i) => (i === 1 ? `card-2|Weak: ${FIELDS[1].weak}` : s)));
  await expect(feedback(page).locator('p').first()).toHaveText('Your prediction. Yes, the same three headings.');
  await expect(tryIt(page).locator('fieldset.build .feedback')).toHaveCount(0);
  await expect(tryIt(page).locator('.picked')).not.toContainText('you picked the');
});
