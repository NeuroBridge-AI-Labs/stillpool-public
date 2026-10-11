// 4.6's "Injection spotter" (stage I, R-4.6) on the fixture build: the shared case checks, then what is special to it: two of
// the five messages hide a line, the one link is Tensor Trust and is link only, and the recorded part waits for the last answer.
import { CASES, OPTIONS } from '../../src/lib/injection-spotter.ts';
import { afterChecks } from '../after-cases.ts';
import { answerAll, answerOf, type Cases, caseChecks, tryIt } from '../cases.ts';
import { expect, test } from '../guard.ts';

const c: Cases = {
  lesson: '/learn/using-ai-well/when-text-tricks-the-ai/',
  picks: [OPTIONS[0], OPTIONS[1], OPTIONS[2], OPTIONS[0], OPTIONS[1]],
  scenes: CASES.map((x) => x.scene),
  answers: CASES.map((x) => x.answer[2].text),
};
caseChecks(c);
afterChecks(c, 'R-4.6', ['No hidden line', 'A hidden line asking for a sea poem instead of the summary', 'A hidden line asking to end the summary with the word PINEAPPLE']);

test('five messages, two hide a line, and the hidden line is quoted only where there is one', async ({ page }) => {
  const hiding = CASES.map((x) => x.answer[0].text === 'Hides an instruction');
  expect(hiding.filter(Boolean)).toHaveLength(2);
  await page.goto(c.lesson);
  await answerAll(page, c);
  for (const [k, h] of hiding.entries()) {
    await expect(answerOf(page, k).locator('blockquote.sent')).toHaveCount(h ? 1 : 0);
    await expect(answerOf(page, k)).toContainText(h ? CASES[k].answer[1].text : `The hidden line: ${CASES[k].answer[1].text}`);
  }
});

test('the only link in the cases is the game to practise on, and its row says link only', async ({ page }) => {
  await page.goto(c.lesson);
  await answerAll(page, c);
  const links = tryIt(page).locator('[data-case] a');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute('href', 'https://tensortrust.ai/');
  await expect(answerOf(page, 4)).toContainText('A game to practise on (link only):');
});
