// The practice lab page (lab-spec G3). The server route is stubbed in every test: nothing here reaches a model.
import axe from 'axe-core';
import { expect, test, type Page } from './guard.ts';

// Reduced motion, so a colour transition set off by a state change has ended before axe reads the colours (checks/axe.ts).
test.use({ reducedMotion: 'reduce' });

const reply = {
  ai_answer: 'A packing list: <img src=x onerror=alert(1)>',
  worked: 'You named the trip.',
  try_next: 'Add the season.',
  why: 'Context tells the AI what to leave out.',
  example_prompt: 'Make a packing list for two days by train in winter.',
  note: 'Leave personal details out.',
};
const PROMPT = 'Make a packing list for a trip.';

// Records every post and answers it with `status` and `body`. Returns the posted bodies.
async function stub(page: Page, status = 200, body: unknown = reply) {
  const posted: { method: string; body: unknown }[] = [];
  await page.route('**/api/lab/', (route) => {
    posted.push({ method: route.request().method(), body: route.request().postDataJSON() });
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return posted;
}

async function openLab(page: Page) {
  await page.goto('/lab/');
  await page.getByRole('button', { name: 'I understand. Start.' }).click();
}

async function fillAndSend(page: Page, example = false) {
  await page.getByRole('radio', { name: /^Context\./ }).check();
  await page.getByLabel('Your prompt').fill(PROMPT);
  if (example) await page.getByLabel('Also show an improved version of my prompt').check();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

const state = (page: Page) => page.locator('[data-lab]').getAttribute('data-state');

async function noAxeViolation(page: Page) {
  await page.evaluate(axe.source);
  const found = await page.evaluate(() =>
    axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }).then((r) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')} ${v.nodes[0]?.any[0]?.message}`)),
  );
  expect(found).toEqual([]);
}

test('nothing is sent on load, on Start, or while typing; only Send posts, with exactly three keys', async ({ page }) => {
  const posted = await stub(page);
  const urls: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && urls.push(new URL(r.url()).pathname));
  await page.goto('/lab/');
  await expect(page.locator('[data-when="form"]')).toBeHidden();
  await page.getByRole('button', { name: 'I understand. Start.' }).click();
  await page.getByRole('radio', { name: /^Context\./ }).check();
  await page.getByLabel('Your prompt').fill(PROMPT);
  expect(posted).toEqual([]);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeVisible();
  expect(posted).toEqual([{ method: 'POST', body: { exercise: 'context', prompt: PROMPT, example: false } }]);
  expect(urls, 'the host serves /api/lab/ (trailingSlash); /api/lab answers 308').toEqual(['/api/lab/']);
});

test('Send stays disabled until an exercise is picked and the prompt is not blank', async ({ page }) => {
  await stub(page);
  await openLab(page);
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await expect(page.getByText('Pick one exercise first.')).toBeVisible();
  await page.getByLabel('Your prompt').fill('   ');
  await page.getByRole('radio', { name: /^Context\./ }).check();
  await expect(send).toBeDisabled();
  await page.getByLabel('Your prompt').fill(PROMPT);
  await expect(send).toBeEnabled();
});

test('the answer and every coaching field show as text, and planted markup is never run', async ({ page }) => {
  await stub(page);
  await openLab(page);
  await fillAndSend(page, true);
  const answer = page.locator('[data-answer]');
  await expect(answer.locator('[data-field="ai_answer"]')).toHaveText(reply.ai_answer);
  for (const [field, text] of Object.entries(reply)) await expect(answer.locator(`[data-field="${field}"]`)).toHaveText(text);
  await expect(answer.locator('img')).toHaveCount(0);
  await expect(answer.getByText('A note')).toBeVisible();
  await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeFocused();
  await expect(page.getByText('Written by Mistral Large (mistral-large-2512')).toBeVisible();
  await noAxeViolation(page);
  // The guard fails this test at teardown if the planted onerror called alert, or anything logged an error.
});

test('a null note and a null improved version show no empty row', async ({ page }) => {
  await stub(page, 200, { ...reply, note: null, example_prompt: null });
  await openLab(page);
  await fillAndSend(page);
  await expect(page.locator('[data-answer]')).toBeVisible();
  await expect(page.locator('[data-row]:visible')).toHaveCount(0);
});

test('Cancel aborts the wait and returns to the form with the text kept', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((done) => (release = done));
  await page.route('**/api/lab/', async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) }).catch(() => {});
  });
  await openLab(page);
  await fillAndSend(page);
  const send = page.getByRole('button', { name: 'Sending' });
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-live]')).toHaveText('Sent. Waiting for the answer.');
  await noAxeViolation(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await state(page)).toBe('ready');
  await expect(page.locator('[data-live]')).toHaveText('Cancelled. Nothing was kept.');
  await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
  release();
  await expect(page.locator('[data-answer]')).toBeHidden();
});

test('Start a new prompt clears the prompt and the answer; Try again sends the same prompt', async ({ page }) => {
  const posted = await stub(page);
  await openLab(page);
  await fillAndSend(page);
  await page.getByRole('button', { name: 'Try again with this prompt' }).click();
  await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeFocused();
  expect(posted.map((p) => p.body)).toEqual([posted[0].body, posted[0].body]);
  await page.getByRole('button', { name: 'Start a new prompt' }).click();
  await expect(page.getByLabel('Your prompt')).toHaveValue('');
  await expect(page.getByLabel('Your prompt')).toBeFocused();
  await expect(page.locator('[data-answer]')).toBeHidden();
});

test('the whole path works by keyboard alone, and Enter in the prompt is a new line', async ({ page }) => {
  const posted = await stub(page);
  await page.goto('/lab/');
  await page.getByRole('button', { name: 'I understand. Start.' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Pick one exercise', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown'); // the first radio takes focus; the arrow picks the next one
  await expect(page.getByRole('radio', { name: /^Context\./ })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Your prompt')).toBeFocused();
  await page.keyboard.type('Line one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line two');
  expect(posted).toEqual([]);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeFocused();
  expect(posted[0].body).toEqual({ exercise: 'context', prompt: 'Line one\nLine two', example: true });
});

test('every exercise on the page is one the server knows, and the distress line shows in every state', async ({ page }) => {
  await stub(page);
  await page.goto('/lab/');
  const care = page.getByText('If you are in distress or at risk, do not use this page. Call 112 or 999, or Samaritans on 116 123.');
  await expect(care).toBeVisible();
  await expect(page.getByText('Pressing Send sends your text to Mistral in Paris.')).toBeHidden();
  await noAxeViolation(page);
  await page.getByRole('button', { name: 'I understand. Start.' }).click();
  await expect(care).toBeVisible();
  const ids = await page.locator('input[name="exercise"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(ids).toEqual(['bad-and-good-prompts', 'context', 'examples', 'format', 'roles-and-ground-rules', 'iterate-and-check']);
  await noAxeViolation(page);
});

test('with interactives set to text, the lab is unchanged', async ({ page }) => {
  const posted = await stub(page);
  await page.addInitScript(() => localStorage.setItem('nbl:settings', JSON.stringify({ textversion: 'on' })));
  await openLab(page);
  await fillAndSend(page);
  await expect(page.locator('[data-field="ai_answer"]')).toHaveText(reply.ai_answer);
  expect(posted).toHaveLength(1);
});

test('Back to the page after a send starts at the notice again', async ({ page }) => {
  await stub(page);
  await openLab(page);
  await fillAndSend(page);
  await page.goto('/help/');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'I understand. Start.' })).toBeVisible();
  await expect(page.locator('[data-answer]')).toBeHidden();
  expect(await state(page)).toBe('idle');
});

// Every test below stubs a refusal on purpose, so the browser's console line for it is expected (e2e/guard.ts).
test.describe('refusals and the rules around them', () => {
  test.use({ allowApiRefusal: true });

  // Answers each post with the next entry, and the last one again after that. Returns the posted bodies.
  async function sequence(page: Page, steps: { status: number; body: unknown }[]) {
    const posted: unknown[] = [];
    await page.route('**/api/lab/', (route) => {
      const step = steps[Math.min(posted.length, steps.length - 1)];
      posted.push(route.request().postDataJSON());
      return route.fulfill({ status: step.status, contentType: 'application/json', body: JSON.stringify(step.body) });
    });
    return posted;
  }

  test('429 shows the limit line, keeps the text, and Send works again', async ({ page }) => {
    await stub(page, 429, 'Too many requests');
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-problem]')).toHaveText(/a lot of practice in a short time.*about ten minutes/);
    await expect(page.locator('[data-problem]')).toBeFocused();
    expect(await state(page)).toBe('limit');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await noAxeViolation(page);
  });


  test('503 closed shows the closed line, keeps the text readable, and cannot send', async ({ page }) => {
    await stub(page, 503, { error: 'closed' });
    await openLab(page);
    await fillAndSend(page);
    await expect(page.getByText('The practice lab is closed for now. Your prompt is still in the box, and the lessons work as always.')).toBeVisible();
    expect(await state(page)).toBe('off');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await noAxeViolation(page);
  });


  test('a busy reply says to try later, shows its code as small text, and the text stays', async ({ page }) => {
    await stub(page, 503, { error: 'busy' });
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-problem]')).toHaveText('The AI is busy, or the lab has reached its limit for this month. Try again later.');
    await expect(page.locator('[data-code]')).toHaveText('Code: 503 busy');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    await noAxeViolation(page);
  });


  test('an empty answer and a dropped connection each show their line', async ({ page }) => {
    await page.route('**/api/lab/', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...reply, ai_answer: '' }) }));
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-problem]')).toHaveText('The AI returned no answer this time. You can press Send again.');
    await page.unroute('**/api/lab/');
    await page.route('**/api/lab/', (route) => route.abort('connectionfailed'));
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('[data-problem]')).toHaveText('The lab could not be reached. Check your connection, then press Send again.');
    await expect(page.locator('[data-code]')).toHaveText('Code: offline');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
  });


  test('after an answer, a closed reply hides the answer and its buttons, and a retry sends nothing', async ({ page }) => {
    const posted = await sequence(page, [{ status: 200, body: reply }, { status: 503, body: { error: 'closed' } }]);
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-answer]')).toBeVisible();
    await page.getByRole('button', { name: 'Try again with this prompt' }).click();
    await expect(page.locator('[data-off-line]')).toBeFocused();
    await expect(page.locator('[data-answer]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Try again with this prompt' })).toBeHidden();
    expect(posted).toHaveLength(2);
    // Hidden or disabled is not enough: a click that is dispatched anyway must not leave the page.
    await page.locator('[data-again]').dispatchEvent('click');
    await page.locator('[data-send]').dispatchEvent('click');
    await page.waitForTimeout(200);
    expect(posted).toHaveLength(2);
    expect(await state(page)).toBe('off');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
  });

  test('changing the exercise clears the old result and returns to ready, with the text kept', async ({ page }) => {
    const posted = await stub(page);
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-answer]')).toBeVisible();
    await page.getByRole('radio', { name: /^Format\./ }).check();
    await expect(page.locator('[data-answer]')).toBeHidden();
    await expect(page.locator('[data-field="ai_answer"]')).toHaveText('');
    expect(await state(page)).toBe('ready');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    expect(posted).toHaveLength(1);
    // The same from a failure: the old line goes with the old exercise.
    await page.unroute('**/api/lab/');
    await stub(page, 503, { error: 'busy' });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('[data-problem]')).toBeVisible();
    await page.getByRole('radio', { name: /^Context\./ }).check();
    await expect(page.locator('[data-problem]')).toBeHidden();
    await expect(page.locator('[data-code]')).toBeHidden();
  });

  test('while a reply is awaited the exercise, prompt and example cannot change, and Send keeps focus', async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/api/lab/', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
    });
    await openLab(page);
    await fillAndSend(page);
    const send = page.getByRole('button', { name: 'Sending' });
    await expect(send).toBeFocused();
    await expect(page.getByLabel('Your prompt')).toHaveJSProperty('readOnly', true);
    await page.getByRole('radio', { name: /^Format\./ }).click();
    await page.getByLabel('Also show an improved version of my prompt').click();
    await page.getByLabel('Your prompt').click();
    await page.keyboard.type(' NEW WORDS');
    await expect(page.getByRole('radio', { name: /^Context\./ })).toBeChecked();
    await expect(page.getByLabel('Also show an improved version of my prompt')).not.toBeChecked();
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    release();
    await expect(page.getByRole('heading', { name: "The AI's answer" })).toBeFocused();
    await expect(page.getByLabel('Your prompt')).toHaveJSProperty('readOnly', false);
    await page.getByLabel('Your prompt').fill('Changed after the answer');
    await expect(page.getByLabel('Your prompt')).toHaveValue('Changed after the answer');
  });

  test('a page restored from the back button forgets the old line, the code and the answer', async ({ page }) => {
    const restore = () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    for (const [status, body] of [[429, 'Too many'], [503, { error: 'busy' }]] as const) {
      await page.unroute('**/api/lab/').catch(() => {});
      await stub(page, status, body);
      await openLab(page);
      await fillAndSend(page);
      await expect(page.locator('[data-problem]')).toBeVisible();
      await restore();
      expect(await state(page)).toBe('idle');
      await expect(page.locator('[data-problem]')).toBeHidden();
      await expect(page.locator('[data-code]')).toBeHidden();
      await expect(page.locator('[data-problem]')).toHaveText('');
    }
    await page.unroute('**/api/lab/');
    await stub(page);
    await page.goto('/lab/');
    await page.getByRole('button', { name: 'I understand. Start.' }).click();
    await fillAndSend(page);
    await expect(page.locator('[data-answer]')).toBeVisible();
    await restore();
    await expect(page.locator('[data-field="ai_answer"]')).toHaveText('');
    await expect(page.locator('[data-answer]')).toBeHidden();
  });

  test('a moderation block shows one calm line, no code and no detail, and keeps the text', async ({ page }) => {
    await stub(page, 200, { filtered: true });
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-problem]')).toHaveText("The AI's safety filter stopped this prompt. Nothing was answered. Try a different prompt.");
    await expect(page.locator('[data-code]')).toBeHidden();
    await expect(page.locator('[data-answer]')).toBeHidden();
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  });

  for (const [status, error, line, code] of [
    [504, 'timeout', 'The AI took too long to answer. Wait a little, then press Send again.', 'Code: 504 timeout'],
    [413, 'too_large', 'That prompt is too long to send. Make it shorter, then press Send again.', 'Code: 413 too_large'],
    [502, 'bad_reply', 'The AI sent back an answer the lab could not read. Press Send again.', 'Code: 502 bad_reply'],
  ] as const)
    test(`a ${status} ${error} says what to do, shows its code as small text, and keeps the text`, async ({ page }) => {
      await stub(page, status, { error });
      await openLab(page);
      await fillAndSend(page);
      await expect(page.locator('[data-problem]')).toHaveText(line);
      await expect(page.locator('[data-code]')).toHaveText(code);
      await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    });

  test('a moderation block after an answer clears the old coaching and its buttons, and keeps the text', async ({ page }) => {
    const posted = await sequence(page, [{ status: 200, body: reply }, { status: 200, body: { filtered: true } }]);
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-answer]')).toBeVisible();
    await page.getByRole('button', { name: 'Try again with this prompt' }).click();
    await expect(page.locator('[data-problem]')).toHaveText("The AI's safety filter stopped this prompt. Nothing was answered. Try a different prompt.");
    expect(posted).toHaveLength(2);
    await expect(page.locator('[data-answer]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Try again with this prompt' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start a new prompt' })).toBeHidden();
    await expect(page.locator('[data-field="worked"]')).toHaveText('');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
  });

  test('while a retry is awaited the answer buttons are gone, a reset press does nothing, and the late reply fits the text', async ({ page }) => {
    let calls = 0;
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/api/lab/', async (route) => {
      if (++calls > 1) await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...reply, ai_answer: `Answer ${calls}` }) });
    });
    await openLab(page);
    await fillAndSend(page);
    await expect(page.locator('[data-field="ai_answer"]')).toHaveText('Answer 1');
    await page.getByRole('button', { name: 'Try again with this prompt' }).click();
    expect(await state(page)).toBe('sending');
    await expect(page.getByRole('button', { name: 'Try again with this prompt' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start a new prompt' })).toBeHidden();
    // A click dispatched anyway (the buttons are hidden, not removed) must not reset the form under the pending reply.
    await page.locator('[data-new]').dispatchEvent('click');
    await page.locator('[data-again]').dispatchEvent('click');
    expect(await state(page)).toBe('sending');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    await expect(page.getByRole('radio', { name: /^Context\./ })).toBeChecked();
    release();
    await expect(page.locator('[data-field="ai_answer"]')).toHaveText('Answer 2');
    await expect(page.getByLabel('Your prompt')).toHaveValue(PROMPT);
    expect(calls).toBe(2);
    await expect(page.getByRole('button', { name: 'Start a new prompt' })).toBeVisible();
  });
});
