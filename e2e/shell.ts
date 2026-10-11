// D2's five shell checks (p6 plan), the one function every interactive spec calls. Each failure throws its pinned
// message, so e2e/shell.spec.ts proves each on a known-bad page. Choice controls are button, input and [role=radio]
// (and select, one control: t4 C12) inside a visible step; the shell's own reveal and text switch sit outside the steps.
import type { Page } from './guard.ts';

const fail = (message: string) => {
  throw new Error(message);
};

export async function checkShell(page: Page, url: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const shell = page.locator('[data-shell]');
  const text = shell.locator('.shell-text input');

  // 1 Predict first.
  if (await shell.locator('[data-reveal]').isEnabled()) fail('shell: reveal enabled before a prediction');

  // 4 At 390 by 844, before the reveal and after it, counted by question in each outermost step, so nesting steps changes
  // nothing (p6-3-review S1): a radio group (one name) is one item and any other control is one, five items at most, and
  // five choices at most in a group.
  const most = async () => {
    const counts = await shell.locator('[data-step]:not([data-step] [data-step])').evaluateAll((steps) =>
      steps.map((s) => {
        const controls = [...s.querySelectorAll<HTMLElement>('button, input, select, [role=radio]')].filter((c) => c.checkVisibility());
        const radios = Map.groupBy(controls, (c) => (c.matches('input[type=radio][name]') ? (c as HTMLInputElement).name : c));
        return [radios.size, Math.max(0, ...[...radios.values()].map((g) => g.length))];
      }),
    );
    const choices = Math.max(0, ...counts.map(([, c]) => c));
    if (choices > 5) fail(`shell: ${choices} choices in one step`);
    const items = Math.max(0, ...counts.map(([i]) => i));
    if (items > 5) fail(`shell: ${items} items in one step`);
  };
  await most();

  // 2 The whole task by keyboard alone: from the text switch, Tab reaches each question, Space picks (a number field
  // takes a typed 2, as in 1.3), Enter reveals.
  await text.focus();
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a?.closest('[data-shell]')) return 'out';
      if (a.matches('[data-step] input[type=number]')) return 'number';
      if (a.matches('[data-step] select')) return 'select';
      return a.matches('[data-reveal]') ? 'reveal' : a.matches('[data-step] :is(input, [role=radio])') ? 'choice' : '';
    });
    if (at === 'out') break;
    if (at === 'choice') await page.keyboard.press('Space');
    if (at === 'number') await page.keyboard.type('2');
    // A closed select takes type-ahead on every system (an arrow key opens its list on a Mac): type the first letter of its first option (3.8).
    if (at === 'select') await page.keyboard.type(await page.evaluate(() => (document.activeElement as HTMLSelectElement).options[1].text[0]));
    if (at === 'reveal') {
      await page.keyboard.press('Enter');
      break;
    }
  }
  if (!(await shell.evaluate((s) => s.classList.contains('revealed')))) fail('shell: step not reachable by keyboard');
  await most();

  // 5 After the reveal, 3 s with no DOM change and no running animation in the shell (the page's own: check:stillness).
  await shell.evaluate((s) => {
    const w = window as unknown as { moved: number };
    w.moved = 0;
    new MutationObserver((r) => (w.moved += r.length)).observe(s, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.waitForTimeout(3_000);
  const moved = await shell.evaluate((s) => (window as unknown as { moved: number }).moved + s.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
  if (moved) fail('shell: moved after the reveal');

  // 3 The text version, on a fresh load before any pick (p6-1-review S1): Space on the switch turns it on, every step and
  // everything shown after the reveal is visible, and no choice control is left to use.
  await page.goto(url);
  await text.focus();
  await page.keyboard.press('Space');
  if (!(await page.locator('html[data-textversion]').count())) fail('shell: text switch does nothing');
  const shown = await shell.locator('[data-step], .after-pick').evaluateAll((els) => els.every((e) => (e as HTMLElement).checkVisibility()));
  if (!shown) fail('shell: text version misses a step');
  if (await shell.locator('[data-step]').locator('button, input, select, [role=radio]').evaluateAll((cs) => cs.some((c) => (c as HTMLElement).checkVisibility())))
    fail('shell: text version still asks for a choice');
}
