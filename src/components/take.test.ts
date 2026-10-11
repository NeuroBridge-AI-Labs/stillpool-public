// The take's bold renderer (Take.astro): **bold** becomes <strong>, everything else is escaped, an unmatched ** stays text.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import Take from './Take.astro';

const html = async (...paragraphs: string[]) =>
  (await AstroContainer.create()).renderToString(Take, { props: { take: { paragraphs, by: 'Emanuel Covasa', approvedBy: 'Emanuel' } } });

test('a script outside bold is escaped text', async () => {
  const out = await html('<script>steal()</script> **safe & sound**');
  expect(out).toContain('<p>&lt;script&gt;steal()&lt;/script&gt; <strong>safe &amp; sound</strong></p>');
  expect(out).not.toContain('<script');
});

test('a script inside bold is escaped inside the strong', async () => {
  expect(await html('**<script>steal()</script>**')).toContain('<p><strong>&lt;script&gt;steal()&lt;/script&gt;</strong></p>');
});

test('an ampersand is escaped', async () => {
  expect(await html('A & B')).toContain('<p>A &amp; B</p>');
});

test('an unmatched ** stays as text, and matched pairs around it still bold', async () => {
  const out = await html('unbalanced **', 'one **two** and **three');
  expect(out).toContain('<p>unbalanced **</p>');
  expect(out).toContain('<p>one <strong>two</strong> and **three</p>');
});
