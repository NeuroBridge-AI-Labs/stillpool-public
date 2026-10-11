// Lesson 1.7's "Watch it learn" (its brief, Interactive; p6 D2): the shell's five checks, T10 (every dot, ring, line,
// point and word on the page is src/lib/watch-it-learn.ts run on the committed file, computed here, never copied) and
// T11 (stepping by button only).
import { readFileSync } from 'node:fs';
import { ends, learnData, watchItLearn } from '../../src/lib/watch-it-learn.ts';
import { expect, type Page, test } from '../guard.ts';
import { checkShell } from '../shell.ts';

const LESSON = '/learn/how-ai-works/training/';
const DATA = learnData.parse(JSON.parse(readFileSync('data/interactive/watch-it-learn.json', 'utf8')));
const RUN = watchItLearn(DATA);
const LAST = RUN.rounds.length - 1;
const L = DATA.limit;
// The brief's drawing rules, for the dot chart and the "How wrong the guesses are" chart.
const at = (x: number, y: number) => [10 + (x + L) * 30, 310 - (y + L) * 30];
const L0 = Math.max(RUN.rounds[0].loss, RUN.rounds[0].newLoss);
const loss = (key: 'loss' | 'newLoss', r: number) => RUN.rounds.slice(0, r + 1).flatMap((o) => [20 + 28 * o.r, 110 - (100 * o[key]) / L0]);
const drawn = (w: [number, number, number]) => ends(w, L).flatMap(([, x, y]) => at(x, y));
const dot = (i: number) => at(RUN.dots[i].x, RUN.dots[i].y);
// Drawn numbers match to within 0.01; a failure shows the wanted value where it differs.
const near = (got: number[], want: number[], label: string) => expect(got, label).toEqual(want.map((w, i) => (Math.abs(got[i] - w) <= 0.01 ? got[i] : w)));
const EXAMPLES = [...RUN.dots.keys()].filter((i) => !RUN.dots[i].new);
const box = (page: Page) => page.locator('.watch-it-learn');

// Everything drawn, read in one go: centres, line ends, polyline points, the visible groups and words.
const read = (page: Page) =>
  box(page).evaluate((b) => {
    const num = (e: Element, ...names: string[]) => names.map((n) => Number(e.getAttribute(n)));
    const centre = (e: Element) => (e.tagName === 'rect' ? num(e, 'x', 'y').map((v) => v + 6) : num(e, 'cx', 'cy'));
    // checkVisibility() says true for an SVG group under display: none, so SVG is read by its styles up to the HTML.
    const vis = (e: Element | null): boolean => !e || (getComputedStyle(e).display !== 'none' && (e instanceof HTMLElement ? e.checkVisibility() : vis(e.parentElement)));
    const shown = (sel: string) => [...b.querySelectorAll(sel)].filter(vis);
    const [g] = shown('[data-chart="dots"] [data-round]');
    const words = shown('.rounds [data-round]').map((d) => [...d.querySelectorAll('p')].map((p) => p.textContent));
    return {
      round: Number(g?.getAttribute('data-round')),
      data: ['data-wrong', 'data-new-wrong', 'data-w'].map((n) => g?.getAttribute(n)),
      line: num(g.querySelector('line')!, 'x1', 'y1', 'x2', 'y2'),
      rings: [...g.querySelectorAll('[data-ring]')].map((c) => [Number(c.getAttribute('data-ring')), ...centre(c)]),
      dots: [...b.querySelectorAll('[data-dot]')].map((d) => [Number(d.getAttribute('data-dot')), ...centre(d)]),
      setup: Object.fromEntries([...b.querySelectorAll('[data-line]')].map((l) => [l.getAttribute('data-line'), num(l, 'x1', 'y1', 'x2', 'y2')])),
      loss: shown('[data-chart="loss"] [data-round] polyline').map((p) => p.getAttribute('points')!.split(/[ ,]/).map(Number)),
      words,
      rounds: shown('svg [data-round]').map((g) => Number(g.getAttribute('data-round'))),
      name: b.querySelector('[data-chart="dots"]')?.getAttribute('aria-label'),
    };
  });
const start = async (page: Page, depth: string) => {
  await page.goto(`${LESSON}?depth=${depth}`);
  await box(page).getByRole('radio', { name: 'Line B is flat, across the middle.' }).check();
  await box(page).getByRole('button', { name: 'Start training' }).click();
};
const next = (page: Page) => box(page).getByRole('button', { name: 'Next round' });
const back = (page: Page) => box(page).getByRole('button', { name: 'Back' });
// T10's bans on the interactive's own text: no percentage, no "x of y", no total of rounds.
const BANNED = [/%/, /\b\d+ (?:of|out of) \d+\b/i, /\d\s*\/\s*\d/, /\d+\s+rounds?\b/i, /\brounds? (?:left|remaining)\b/i];
const clean = async (page: Page) => {
  const text = await box(page).innerText();
  for (const re of BANNED) expect(text, String(re)).not.toMatch(re);
};

test("D2: the shell's five checks", ({ page }) => checkShell(page, LESSON));

test('T10 every round on the page is the build run on the committed file, at both depths, and says no total', async ({ page }) => {
  for (const depth of ['simple', 'deep']) {
    await start(page, depth);
    for (let r = 0; r <= LAST; r++) {
      const o = RUN.rounds[r];
      const got = await read(page);
      expect(got.rounds, `round ${r}: one round per chart`).toEqual([r, r]);
      expect([got.round, ...got.data], `round ${r}`).toEqual([r, o.wrong.join(' '), o.newWrong.join(' '), o.w.join(' ')]);
      near(got.line, drawn(o.w), `round ${r} line`);
      near(got.rings.flat(), [...o.wrong, ...o.newWrong].flatMap((i) => [i, ...dot(i)]), `round ${r} rings`);
      // The set-up chart and the three choice pictures each draw the example dots; the dot chart draws them all.
      near(got.dots.flat(), [...Array(4).fill(EXAMPLES).flat(), ...RUN.dots.keys()].flatMap((i) => [i, ...dot(i)]), 'dots');
      near(got.loss.flat(), depth === 'deep' ? [...loss('loss', r), ...loss('newLoss', r)] : loss('loss', r), `round ${r} loss line`);
      const deep = depth === 'deep' && o.deep ? [o.deep] : [];
      expect(got.words.map((w) => w.slice(0, 2 + deep.length)), `round ${r} words`).toEqual([[o.words, o.where, ...deep]]);
      expect(got.name).toBe(`${o.words} ${o.where}`);
      if (r === 0) for (const [k, w] of Object.entries({ start: DATA.start, ...DATA.candidates })) near(got.setup[k], drawn(w), `set-up line ${k}`);
      if (r < LAST) await next(page).click();
    }
    await expect(box(page).getByText(`The line ended up closest to line ${RUN.closest}. You picked line B.`)).toBeVisible();
    await clean(page);
    await box(page).getByLabel('Read it as text instead').check();
    const text = await read(page);
    expect(text.words.map((w) => w.slice(0, 2)), 'the text version lists every round').toEqual(RUN.rounds.map((o) => [o.words, o.where]));
    expect(text.rounds, 'each chart shows the last round').toEqual([LAST, LAST]);
    await expect(box(page).getByText('Which picture shows where the line will end up?'), 'the picture-only question is hidden').toBeHidden();
    await expect(box(page).getByRole('group', { name: 'Which picture shows where the line will end up?' }), 'no empty group is left in the accessibility tree').toHaveCount(0);
    await clean(page);
    await box(page).getByLabel('Read it as text instead').uncheck();
  }
});

test('T11 stepping: one round a press, the ends say where they are, focus stays, the pick sits by the result, nothing moves alone', async ({ page }) => {
  await start(page, 'simple');
  const live = box(page).locator('[data-live]');
  await expect(live, 'the reveal says round 0').toHaveText(RUN.rounds[0].words);
  await expect(back(page)).toHaveAttribute('aria-disabled', 'true');
  await back(page).focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveText('This is the start, before training.');
  await next(page).focus();
  for (let r = 1; r <= LAST; r++) {
    await page.keyboard.press('Enter');
    await expect(live).toHaveText(RUN.rounds[r].words);
    await expect(next(page)).toBeFocused();
  }
  await expect(next(page)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(live).toHaveText('This is the last round.');
  await expect(box(page).locator('[data-picked]')).toHaveText('You picked line B.');
  await back(page).focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveText(RUN.rounds[LAST - 1].words);
  await expect(back(page)).toBeFocused();
  await page.waitForTimeout(3_000);
  expect((await read(page)).round, 'three seconds without input change nothing').toBe(LAST - 1);
});

// Design run 33 D4 (Emanuel, 28-09-26: "I don't understand which line is it"): before training the chart has the dots
// and the start line only, named in words on it; each choice has its own picture, those dots with that one line. After
// Start training, the guess is a faint dashed line and a legend says which line is which.
test('D4 before training: the start line alone, named on the chart, and each choice with its own picture', async ({ page }) => {
  await page.goto(LESSON);
  const setup = box(page).locator('[data-chart="setup"]');
  await expect(setup.locator('line')).toHaveCount(1);
  await expect(setup.locator('text')).toHaveText(["The model's first try"]);
  await expect(box(page).getByText("The thick line is the model's first try. It is in the wrong place. Each round of training moves it a little.", { exact: true })).toBeVisible();
  await expect(box(page).getByRole('group', { name: 'Which picture shows where the line will end up?' })).toBeVisible();
  for (const [k, w] of Object.entries(DATA.candidates)) {
    const pic = box(page).locator('label', { has: page.getByRole('radio', { name: new RegExp(`^Line ${k} `) }) }).locator('svg[aria-hidden="true"]');
    await expect(pic, `picture ${k}`).toBeVisible();
    const got = await pic.evaluate((svg) => ({
      lines: [...svg.querySelectorAll('line')].map((l) => ['x1', 'y1', 'x2', 'y2'].map((n) => Number(l.getAttribute(n)))),
      dash: svg.querySelector('line')?.getAttribute('stroke-dasharray'),
      dots: [...svg.querySelectorAll('[data-dot]')].map((d) =>
        [Number(d.getAttribute('data-dot')), ...(d.tagName === 'rect' ? ['x', 'y'].map((n) => Number(d.getAttribute(n)) + 6) : ['cx', 'cy'].map((n) => Number(d.getAttribute(n))))]),
    }));
    expect(got.lines, `picture ${k}: one line`).toHaveLength(1);
    expect(got.dash, `picture ${k}: dashed`).toBeTruthy();
    near(got.lines[0], drawn(w), `picture ${k} line`);
    near(got.dots.flat(), EXAMPLES.flatMap((i) => [i, ...dot(i)]), `picture ${k} dots`);
  }
});

test('D4 after Start training: the guess is a faint dashed line with a legend in words; not sure, no dashed line', async ({ page }) => {
  await start(page, 'simple');
  const guess = box(page).locator('[data-chart="dots"] [data-pick="B"]');
  await expect(guess).toHaveAttribute('display', 'inline');
  expect(await guess.locator('line').evaluate((l) => [!!l.getAttribute('stroke-dasharray'), Number(getComputedStyle(l).strokeOpacity) < 1])).toEqual([true, true]);
  const legend = box(page).locator('.legend');
  await expect(legend).toHaveText("Solid line: the model's line. Dashed line: your guess.", { useInnerText: true });
  await page.goto(LESSON);
  await box(page).getByRole('radio', { name: 'I am not sure.' }).check();
  await box(page).getByRole('button', { name: 'Start training' }).click();
  await expect(box(page).locator('[data-chart="dots"] [data-pick][display="inline"]')).toHaveCount(0);
  await expect(legend).toHaveText("Solid line: the model's line.", { useInnerText: true });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('no empty picture-choice group is left, and the word question stays', async ({ page }) => {
    await page.goto(LESSON);
    await expect(box(page).getByRole('group', { name: 'Which picture shows where the line will end up?' })).toHaveCount(0);
    await expect(box(page).getByText('Where will the line end up?').first()).toBeVisible();
  });
});
