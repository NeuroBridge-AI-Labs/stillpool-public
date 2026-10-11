// D2 (p6 plan): the shell's five checks pass on a good page and fail on each known-bad page with its exact message.
// Never test.fail(), which also passes on a page that does not load. The pages are served from fixtures/ on the site's
// own origin, so the guard still sees every request.
import { expect, test } from './guard.ts';
import { checkShell } from './shell.ts';

test.beforeEach(({ page }) => page.route('**/__fixtures/**', (r) => r.fulfill({ path: `fixtures/${new URL(r.request().url()).pathname.split('/__fixtures/')[1]}` })));

test('the good page passes every check', ({ page }) => checkShell(page, '/__fixtures/good/shell/index.html'));

const BAD = [
  ['no-gate', 'reveal enabled before a prediction'],
  ['mouse-only', 'step not reachable by keyboard'],
  ['short-text', 'text version misses a step'],
  ['dead-switch', 'text switch does nothing'],
  ['choice-in-text', 'text version still asks for a choice'],
  ['six-choices', '6 choices in one step'],
  ['nested-six', '6 choices in one step'],
  ['six-questions', '6 items in one step'],
  ['spin-after', 'moved after the reveal'],
];
for (const [name, message] of BAD)
  test(`${name}.html fails with "shell: ${message}"`, async ({ page }) => {
    await expect(checkShell(page, `/__fixtures/bad/shell/${name}.html`)).rejects.toThrow(new RegExp(`^shell: ${message}$`));
  });
