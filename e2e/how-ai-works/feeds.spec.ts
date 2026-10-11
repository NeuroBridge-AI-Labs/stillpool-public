// Lesson 1.10's checks use the build run from the committed data, then test stepping and shapes in the browser.
import { readFileSync } from 'node:fs';
import { feedData, feedSimulator } from '../../src/lib/feed-simulator.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/feeds/';
const DATA = feedData.parse(JSON.parse(readFileSync('data/interactive/feed-simulator.json', 'utf8')));
const RUN = feedSimulator(DATA);
const BANNED = [/\d/, /%/, /\bopens? left\b/i, /\bstreaks?\b/i, /\bleader ?boards?\b/i, /\btimers?\b|\bcount ?down\b|\b(?:time|seconds|minutes) (?:left|remaining)\b/i,
  /\+ ?\d+ ?(?:points|pts)\b|\b(?:earn|win|won|gain|score)\w* (?:\d+ )?points\b/i, /\bXP\b/i, /\blevel ?up\b|\blevel \d+\b|\bnext level\b/i, /\bconfetti\b/i,
  /\d ?% ?(?:complete|done|finished|mastered)\b|\b(?:progress|complete|done)\W{0,3}\d+ ?%/i, /\b\d+ (?:of|out of) \d+\b/i, /\blives (?:left|remaining)\b|\b\d+ lives\b|\blose a life\b/i,
  /\b(?:lose|lost|losing|reset)\w* (?:all )?(?:your )?progress\b|\bprogress (?:will be |is )?(?:lost|reset)\b/i, /\bnotifications?\b|\bnotify\b/i, /\blocked\b|\bunlock/i,
  /\b(?:better|faster|smarter) than (?:\d+ ?% of )?(?:other |most )?(?:learners|people|users|others|friends)\b|\btop \d+ ?%/i, /\bdaily (?:goals?|targets?|challenges?)\b/i];
const box = (page: Page) => page.locator('.feed-simulator');
const [open, back] = ['Open the top item', 'Back'].map((name) => (page: Page) => box(page).getByRole('button', { name }));
const want = (v: { ids: string[]; words: string[] }) => ({ cards: v.ids.map((id) => [id, RUN.cards[id].topic, RUN.cards[id].shape, `${RUN.cards[id].name}: ${RUN.cards[id].title}`]), words: v.words });
const read = (page: Page, sel: string, n = 0) =>
  box(page).locator(sel).evaluateAll((els, n) => els.filter((e) => (e as HTMLElement).checkVisibility()).map((e) => ({
    cards: [...e.querySelectorAll(':scope > ol li')].map((li) => [li.getAttribute('data-item'), li.getAttribute('data-topic'), li.querySelector('svg')?.getAttribute('data-shape'), li.textContent?.trim()]),
    words: [...e.children].filter((p) => p.matches('p:not(.as-text)')).map((p) => p.textContent).slice(0, n || undefined),
  })), n);
const clean = async (page: Page) => {
  const text = (await box(page).innerText()).replace(/Lesson\s3\.2\s/g, ''); // the pointer's lesson number is the one digit
  for (const re of BANNED) expect(text, String(re)).not.toMatch(re);
};
const start = async (page: Page, depth = 'simple') => {
  await page.goto(`${LESSON}?depth=${depth}`);
  await box(page).getByRole('radio', { name: 'Mostly one topic.' }).check();
  await box(page).getByRole('button', { name: 'Start opening' }).click();
};

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));
test('T8 every state and control on the page is the build run on the committed file, at both depths, with no digit', async ({ page }) => {
  for (const depth of ['simple', 'deep']) {
    await start(page, depth);
    for (let k = 0; k <= DATA.opens; k++) {
      expect(await read(page, '[data-state]', RUN.states[k].words.length), `state ${k}`).toEqual([want(RUN.states[k])]);
      if (k < DATA.opens) await open(page).click();
    }
    await expect(box(page).getByText(`${RUN.mostly} You said mostly one topic.`, { exact: true })).toBeVisible();
    await clean(page);
    for (const c of [...RUN.controls.slice(1), RUN.controls[0]]) {
      await box(page).getByRole('radio', { name: c.label }).check();
      expect(await read(page, '[data-control]'), c.label).toEqual([want(c)]);
      await expect(box(page).locator('[data-live]')).toHaveText(c.words.join(' '));
    }
    await box(page).getByLabel('Read it as text instead').check();
    expect(await read(page, '[data-state]', 3), 'the text version lists every state').toEqual(RUN.states.map((s) => ({ ...want(s), words: s.words.slice(0, 3) })));
    expect(await read(page, '[data-control]'), 'and every control').toEqual(RUN.controls.map(want));
    await expect(box(page).locator('[data-control] > .as-text').filter({ visible: true }), 'each control named').toHaveText(RUN.controls.map((c) => c.label));
    await clean(page);
    await box(page).getByLabel('Read it as text instead').uncheck();
  }
});
test('T9 stepping: one state a press, the ends say where they are, focus stays, controls only at the end, nothing moves alone', async ({ page }) => {
  await start(page);
  const [live, controls] = [box(page).locator('[data-live]'), box(page).locator('fieldset', { hasText: 'Try a control' })];
  await expect(live, 'the reveal says the start').toHaveText(RUN.states[0].words.join(' '));
  await expect(back(page)).toHaveAttribute('aria-disabled', 'true');
  await back(page).focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveText('This is the start.');
  await open(page).focus();
  for (let k = 1; k <= DATA.opens; k++) {
    await expect(controls, `hidden before the tenth open (${k - 1})`).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(live).toContainText(RUN.states[k].words.join(' '));
    await expect(open(page)).toBeFocused();
  }
  await expect(controls).toBeVisible();
  await expect(box(page).getByRole('radio', { name: 'No control' })).toBeChecked();
  await expect(open(page)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Tab');
  await expect(box(page).getByRole('radio', { name: 'No control' })).toBeFocused();
  await open(page).focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveText('That was the tenth open. The feed stops here.');
  await back(page).focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveText(RUN.states[DATA.opens - 1].words.join(' '));
  await expect(back(page)).toBeFocused();
  const before = await box(page).innerHTML();
  await page.waitForTimeout(3_000);
  expect(await box(page).innerHTML(), 'three seconds without input change nothing').toBe(before);
});
test('T10 shape, not colour alone: one shape a topic, drawn as that shape, and each card starts with its topic', async ({ page }) => {
  await start(page);
  const cards = await box(page).locator('li[data-topic] svg').evaluateAll((svgs) => svgs.map((svg) => ({
    topic: svg.parentElement?.getAttribute('data-topic'), shape: svg.getAttribute('data-shape'), d: svg.querySelector('path')?.getAttribute('d'), size: svg.getBoundingClientRect().width, text: svg.parentElement?.textContent?.trim() })));
  for (const t of DATA.topics) {
    const own = cards.filter((c) => c.topic === t.id);
    expect(own.map((c) => [c.shape, c.d, c.text?.startsWith(`${t.name}: `)]), t.id).toEqual(own.map(() => [t.shape, own[0].d, true]));
  }
  expect(new Set(cards.map((c) => c.d)).size, 'five shapes drawn').toBe(5);
  expect(Math.min(...cards.filter((c) => c.size).map((c) => c.size)), 'at least 20 px').toBeGreaterThanOrEqual(20);
});
