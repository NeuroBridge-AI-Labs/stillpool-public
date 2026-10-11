// The MIT duty (plan P6.5): /notices shows the copyright and permission notice of gpt-tokenizer and of the icons, word
// for word.
import { readFileSync } from 'node:fs';
import { expect, test } from './guard.ts';

test("the notices page shows gpt-tokenizer's and Phosphor's licences word for word", async ({ page }) => {
  await page.goto('/notices/');
  const words = (text: string) => text.replace(/\s+/g, ' ').trim();
  for (const name of ['gpt-tokenizer', '@phosphor-icons/core'])
    expect(words(await page.locator('main').innerText()), name).toContain(words(readFileSync(`node_modules/${name}/LICENSE`, 'utf8')));
});
