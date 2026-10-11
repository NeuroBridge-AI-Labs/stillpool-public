// Lesson 1.4's "Guess the next word" (its brief, Interactive; p6 D2): the shell's five checks; T5, every chance the page
// shows, at every temperature and in the text version, is the toy run in this process on the training text, with its
// planted known-bad page; the reveal in words; and the pick over every word the toy saw (T7, M6.9.1).
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { after, atTemp, pick, pieces, spread, TEMPS, words } from '../../src/lib/next-word.ts';
import { spoken } from '../../src/lib/tokenizer.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/the-next-word/';
const PS = pieces(readFileSync('data/training/dubliners.txt', 'utf8'));
const STARTS: { text: string; guesses: string[] }[] = JSON.parse(readFileSync('data/interactive/next-word.json', 'utf8')).starts;
type Temp = keyof typeof TEMPS;
const TEMP_NAMES = Object.keys(TEMPS) as Temp[];
const toy = (i: number, t: Temp) => atTemp(after(PS, ...(pieces(STARTS[i].text).slice(-2) as [string, string])), TEMPS[t]);
// The five most seen, then all other words together, as a screen reader hears each (brief, "How it is read").
const heard = (i: number, t: Temp) => {
  const rows = [...toy(i, t)];
  const rest = rows.slice(5).reduce((s, [, p]) => s + p, 0);
  return [...rows.slice(0, 5).map(([w, p]) => `${w}, ${words(p)}`), ...(rest ? [`all other words together, ${words(rest)}`] : [])];
};
const box = (page: Page) => page.locator('.next-word');
const guess = async (page: Page, picks: string[]) => {
  for (const [i, g] of picks.entries()) await box(page).locator(`input[name="s${i + 1}"]`).nth(STARTS[i].guesses.indexOf(g)).check();
  await box(page).getByRole('radio', { name: 'Most had a high chance' }).check();
  await box(page).getByRole('button', { name: 'Show the chances' }).click();
};

// T5: with JavaScript each temperature is chosen, and its lists are the ones shown; without, all nine show at once.
const t5 = async (page: Page, js = true) => {
  for (const t of TEMP_NAMES) {
    if (js) await box(page).getByRole('radio', { name: new RegExp(`^${t}`) }).check();
    for (const i of STARTS.keys()) {
      const list = box(page).locator(`.chances[data-temp="${t}"] ol[data-start="${i + 1}"]`);
      await expect(list).toBeVisible({ timeout: 1_000 });
      await expect(list.locator('li'), `${STARTS[i].text} at ${t}`).toHaveText(heard(i, t), { timeout: 1_000 });
    }
  }
};

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('T5: at every temperature the chances are the toy run here, and a change of temperature is said in words', async ({ page }) => {
  await page.goto(LESSON);
  await guess(page, ['man', 'a', 'beef']);
  await t5(page);
  await expect(box(page).locator('.heard')).toContainText(`High. After "the old": ${heard(0, 'High').join('; ')}.`);
});

test('T5 known-bad: a page with one chance changed from 48 to 47 in 100 fails', async ({ page }) => {
  await page.route(`**${LESSON}`, async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, body: (await res.text()).replace('<li>man, 48 in 100', '<li>man, 47 in 100') });
  });
  await page.goto(LESSON);
  await guess(page, ['man', 'a', 'beef']);
  await expect(t5(page)).rejects.toThrow();
});

test('the reveal names each guess and the chance in words; "Show me without guessing" names the likeliest', async ({ page }) => {
  const say = (i: number, w: string) => `${w}, ${words(toy(i, 'Standard').get(w) ?? 0)}`;
  await page.goto(LESSON);
  await guess(page, ['woman', 'a', 'tea']);
  await expect(box(page).locator('.picked')).toHaveText(
    [
      `You guessed woman. The toy's chance: ${words(toy(0, 'Standard').get('woman') ?? 0)}. Its most likely word here: ${say(0, 'man')}.`,
      `You guessed a. It is the toy's most likely word here: ${words(toy(1, 'Standard').get('a') ?? 0)}.`,
      `You guessed tea. The toy never saw "tea" after "cup of", so it never picks it. Its only word here: ${say(2, 'beef')}.`,
      'About the caring reply, you guessed: most had a high chance.',
    ].join('\n'),
  );
  await page.reload();
  await box(page).getByRole('button', { name: 'Show me without guessing' }).click();
  await expect(box(page).locator('.picked')).toContainText(`The toy's only word after "cup of": ${say(2, 'beef')}.`);
  await expect(box(page).locator('.chances.shown').first()).toBeVisible();
});

// T7 on the page (M6.9.1): at Standard after "there was", a draw of 0.72 lands past the five shown words.
test('the pick draws over every word the toy saw, newest first; ten at once; the list clears; and it follows the temperature', async ({ page }) => {
  await page.addInitScript(() => (Math.random = () => 0.72));
  const word = pick(toy(1, 'Standard'), 0.72);
  expect(heard(1, 'Standard').slice(0, 5).map((l) => l.split(',')[0])).not.toContain(word);
  await page.goto(LESSON);
  await guess(page, ['man', 'a', 'beef']);
  await box(page).getByRole('radio', { name: 'there was' }).check();
  await box(page).getByRole('button', { name: 'Pick a word' }).click();
  await expect(box(page).locator('.heard')).toHaveText(`Picked: ${word}. ${STARTS[1].text} ${word}.`);
  await box(page).getByRole('button', { name: 'Pick ten' }).click();
  await expect(box(page).locator('.sentences li')).toHaveCount(11);
  await box(page).getByRole('button', { name: 'Clear the list' }).click();
  await expect(box(page).locator('.sentences li')).toHaveCount(0);
  // p6-9-review S1: the pick follows the chosen temperature; at High a draw of 0.30 gives a word Standard does not.
  const high = pick(toy(1, 'High'), 0.3);
  expect(high).not.toBe(pick(toy(1, 'Standard'), 0.3));
  await page.evaluate(() => (Math.random = () => 0.3));
  await box(page).getByRole('radio', { name: /^High/ }).check();
  await box(page).getByRole('button', { name: 'Pick a word' }).click();
  await expect(box(page).locator('.heard')).toHaveText(`Picked: ${high}. ${STARTS[1].text} ${high}.`);
});

// T8 on the page (P6.10): run 1 of the warm reply, each piece's chance e to the power of its stored logprob, the
// summary by the brief's rule, and the temperature the recording stores, not 0.7.
const REC = JSON.parse(readFileSync('data/recorded/R-1.1.json', 'utf8'));
const WARM: { text: string; logprob: number }[] = REC.variants.find((v: { instruction: string }) => /warm/i.test(v.instruction)).runs[0].pieces;
test('T8: the caring reply piece by piece, each chance from its logprob, the summary by rule and the stored temperature', async ({ page }) => {
  const kind = (t: string) => (t === '</s>' ? 'the end marker' : t ? ((w, q) => w + (q && `"${q}"`))(...spoken({ text: t })) : 'a piece with no text');
  await page.goto(LESSON);
  await guess(page, ['man', 'a', 'beef']);
  const r11 = box(page).locator('.r11');
  const sr = r11.locator('.reply .sr');
  // p6-10-review S1: every piece that is only a mark is named in words, as 1.3's box names it, never read as a bare mark.
  const marks = [...WARM.entries()].filter(([, p]) => /^\p{P}+$/u.test(p.text));
  expect(marks).toHaveLength(11);
  const name: Record<string, string> = { ',': 'comma', '.': 'full stop', '!': 'exclamation mark' };
  for (const [i, p] of marks) await expect(sr.nth(i)).toHaveText(`${name[p.text]}, ${words(Math.exp(p.logprob))}`);
  await expect(sr).toHaveText(WARM.map((p) => `${kind(p.text)}, ${words(Math.exp(p.logprob))}`));
  // p6-10-review S2: each piece under 50 in 100 carries the words "less likely" beside its chance.
  await expect(r11.locator('.less')).toHaveText(WARM.filter((p) => Math.exp(p.logprob) < 0.5).map((p) => `${words(Math.exp(p.logprob))}, less likely`));
  await expect(r11).toContainText(`${spread(WARM.map((p) => Math.exp(p.logprob)))} You guessed: most had a high chance.`);
  // Fact-check S2 (28-09-26): the stored line is reworded where it shows, never edited in the file (D4).
  await expect(r11).toContainText('Temperature: not sent, and the value the service used was not recorded.');
  expect(await r11.innerText()).not.toMatch(/\b0\.7\b/);
});

for (const theme of ['light', 'dark', 'contrast', 'device'])
  test(`no axe violation after the reveal and ten picks, in the ${theme} theme at 390 wide`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'device' ? 'dark' : 'light' });
    await page.addInitScript((t) => localStorage.setItem('nbl:settings', JSON.stringify({ theme: t })), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(LESSON);
    await guess(page, ['woman', 'no', 'tea']);
    await box(page).getByRole('button', { name: 'Pick ten' }).click();
    await page.evaluate(axe.source);
    const found = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
    expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every chance at every temperature is text, with the "cup of" line and the one sentence', async ({ page }) => {
    await page.goto(LESSON);
    await t5(page, false);
    for (const line of ['"his cup of beef-tea"', 'likely is not the same as true', 'Chances are rounded']) await expect(box(page).getByText(line)).toBeVisible();
    await expect(box(page).getByRole('radio').first()).toBeHidden();
  });
});

test('no score, percentage, "N of M" or "correct" anywhere', async ({ page }) => {
  await page.goto(LESSON);
  await guess(page, ['man', 'a', 'beef']);
  expect(await box(page).innerText()).not.toMatch(/%|\b\d+ (?:of|out of) \d+\b|\b(?:score|correct|wrong answer)\b/i);
});
