// Lesson 1.9's "Doodle guesser" (its brief, T9 to T12; p6 D2). Every guess, chance and rule line the page shows is
// worked out here again with src/lib/doodle.ts from the committed weights and data file, never copied into this test.
import { readFileSync } from 'node:fs';
import { chances, copyNamed, highChance, named, prepare, render, rows, words, type Drawing, type Model } from '../../src/lib/doodle.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/images-and-sound/';
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const [SIX, THREE]: Model[] = [json('data/doodle/six-kinds.weights.json'), json('data/doodle/three-kinds.weights.json')];
const EXAMPLES: { kind: string; drawing: Drawing }[] = json('data/interactive/doodle-guesser.json').examples;
// checks/content.ts, "x of y counts", copied as 1.2 to 1.7's specs do.
const X_OF_Y = /\b\d+ (?:of|out of) \d+\b/i;
// Pack I4: each kind's first 2,000 recognised doodles are for learning.
const LEARNED = 2000;
// A two-stroke house, in CSS pixels from the pad's corner: a square, then a roof.
const HOUSE = [[[60, 100], [180, 100], [180, 200], [60, 200], [60, 100]], [[60, 100], [120, 40], [180, 100]]];
const box = (page: Page) => page.locator('.doodle-guesser');

// What the build or the pad must show for one model on one drawing: the guess line, the rows in words, their chances.
const expected = (m: Model, pixels: number[], who: string) => {
  const r = rows(m, chances(m, pixels));
  return { guess: `The ${who} guess: ${r[0].kind}.`, top: r[0], words: r.map((x) => `${x.kind}, ${words(x.chance)}`), chances: r.map((x) => x.chance) };
};
const lines = (kind: string, pixels: number[]) => {
  const [six, three] = [expected(SIX, pixels, "model's"), expected(THREE, pixels, "copy's")];
  const model = [six.guess, `The player was asked to draw a ${kind}.`, named(kind, six.top.kind)];
  return { six, three, model, copy: [three.guess, copyNamed(kind, three.top.kind), highChance(three.top.kind, three.top.chance)].filter(Boolean) };
};
const checkPart = async (part: ReturnType<Page['locator']>, want: { words: string[]; chances: number[] }, paragraphs: string[]) => {
  await expect(part.locator('li')).toHaveText(want.words);
  const got = await part.locator('li').evaluateAll((ls) => ls.map((l) => Number((l as HTMLElement).dataset.chance)));
  expect(got.map((c, i) => Math.abs(c - want.chances[i]) < 1e-12)).toEqual(want.chances.map(() => true));
  await expect(part.locator('p')).toHaveText(paragraphs);
};
const reveal = async (page: Page, doodle: string) => {
  if (doodle) await box(page).getByLabel(doodle).check();
  await box(page).getByLabel('What the doodle shows').check();
  await box(page).getByRole('button', { name: "Show the model's guess" }).click();
};
const toCopy = async (page: Page) => {
  await box(page).getByLabel('One of its three kinds').check();
  await box(page).getByRole('button', { name: 'Switch to the copy' }).click();
};
const interfaceText = async (page: Page) => `${await box(page).innerText()}\n${await page.locator('.credit').innerText()}`;

test("T9 D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('T10: each example shows the committed weights\' output, and no weights file is asked for', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => r.url().includes('weights') && asked.push(r.url()));
  for (const { kind, drawing } of EXAMPLES) {
    await page.goto(LESSON);
    const want = lines(kind, render(drawing));
    await reveal(page, `The ${kind} doodle`);
    await checkPart(box(page).locator(`[data-for="${kind}"].shown .model`), want.six, want.model);
    await toCopy(page);
    await checkPart(box(page).locator('.copy-said'), want.three, ['You said the copy would name one of its three kinds.', ...want.copy]);
    const text = await interfaceText(page);
    expect([text.includes('%'), X_OF_Y.test(text), /\bcorrect\b/i.test(text)]).toEqual([false, false, false]);
  }
  expect(asked).toEqual([]);
});

test('T11: the drawing path is real, lazy and private', async ({ page, baseURL }) => {
  const requests: { url: string; method: string }[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  const stored = () => page.evaluate(async () => [{ ...localStorage }, { ...sessionStorage }, await indexedDB.databases()]);
  await page.goto(LESSON);
  await page.waitForLoadState('networkidle');
  expect(requests.filter((r) => r.url.includes('weights'))).toEqual([]);
  const before = await stored();
  const pad = box(page).locator('.pad svg');
  await pad.scrollIntoViewIfNeeded();
  const at = await pad.boundingBox();
  for (const stroke of HOUSE) {
    await page.mouse.move((at?.x ?? 0) + stroke[0][0], (at?.y ?? 0) + stroke[0][1]);
    await page.mouse.down();
    for (const [x, y] of stroke.slice(1)) await page.mouse.move((at?.x ?? 0) + x, (at?.y ?? 0) + y);
    await page.mouse.up();
  }
  await expect(box(page).getByLabel('My own drawing')).toBeChecked();
  const weights = requests.filter((r) => r.url.includes('weights')).map((r) => new URL(r.url));
  expect(weights.map((u) => [u.origin, u.pathname.split('/').pop()?.split('.')[0]])).toEqual([[baseURL, 'six-kinds'], [baseURL, 'three-kinds']]);
  const pixels = render(prepare(HOUSE.map((s) => [s.map(([x]) => x), s.map(([, y]) => y)])));
  const [six, three] = [expected(SIX, pixels, "model's"), expected(THREE, pixels, "copy's")];
  const [modelLine, copyLine] = ['Only you can say whether that fits what you drew.', "The copy's only answers are apple, house and umbrella. If you drew anything else, it could not name it."];
  await reveal(page, '');
  await checkPart(box(page).locator('[data-for="own"].shown .model'), six, [six.guess, modelLine]);
  await toCopy(page);
  await checkPart(box(page).locator('.copy-said'), three, ['You said the copy would name one of its three kinds.', three.guess, copyLine]);
  expect(await stored()).toEqual([...before.slice(0, 2), []]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
  await box(page).getByRole('button', { name: 'Clear the pad' }).click();
  await expect(pad.locator('polyline')).toHaveCount(0);
  await expect(box(page).getByLabel('My own drawing')).toBeDisabled();
});

// Review p6-22 S1: a pad cleared while the weights are still loading must not tick "My own drawing" again.
test('T11b: clearing the pad while the weights load leaves nothing chosen', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/*weights*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(LESSON);
  const pad = box(page).locator('.pad svg');
  await pad.scrollIntoViewIfNeeded();
  const at = await pad.boundingBox();
  await page.mouse.move((at?.x ?? 0) + HOUSE[0][0][0], (at?.y ?? 0) + HOUSE[0][0][1]);
  await page.mouse.down();
  for (const [x, y] of HOUSE[0].slice(1)) await page.mouse.move((at?.x ?? 0) + x, (at?.y ?? 0) + y);
  await page.mouse.up();
  await box(page).getByRole('button', { name: 'Clear the pad' }).click();
  release();
  await page.waitForLoadState('networkidle');
  await expect(box(page).getByLabel('My own drawing')).not.toBeChecked();
  await expect(box(page).getByLabel('My own drawing')).toBeDisabled();
  await expect(pad.locator('polyline')).toHaveCount(0);
  await expect(box(page).locator('.pad-state')).toHaveText('');
});

test('T12: the text version shows every example in words, and no pad', async ({ page }) => {
  await page.goto(LESSON);
  await box(page).getByLabel('Read it as text instead').check();
  for (const { kind, drawing } of EXAMPLES) {
    const want = lines(kind, render(drawing));
    const block = box(page).locator(`[data-for="${kind}"]`);
    await expect(block.locator('.as-text')).toBeVisible();
    await expect(block.locator('.as-text')).toHaveText(new RegExp(`^The ${kind} doodle: \\S`));
    await checkPart(block.locator('.model'), want.six, want.model);
    await checkPart(block.locator('.copy'), want.three, want.copy);
  }
  const [n, kinds] = [(k: number) => k.toLocaleString('en-GB'), `${SIX.kinds.slice(0, -1).join(', ')} and ${SIX.kinds.at(-1)}`];
  await expect(box(page).getByText(`This model learned from ${n(LEARNED * SIX.kinds.length)} doodles: ${n(LEARNED)} each of six kinds. The kinds are ${kinds}.`)).toBeVisible();
  await expect(page.locator('.credit')).toContainText(`We kept ${n(LEARNED)} of each of six kinds, drew them on a 28 by 28 grid`);
  await expect(box(page).locator('.pad svg')).toBeHidden();
  await expect(box(page).getByRole('button', { name: 'Clear the pad' })).toBeHidden();
  const text = await interfaceText(page);
  expect([text.includes('%'), X_OF_Y.test(text)]).toEqual([false, false]);
});
