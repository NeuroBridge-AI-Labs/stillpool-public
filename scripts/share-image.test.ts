import { globSync } from 'node:fs';
import { relative } from 'node:path';
import { expect, test } from 'vitest';
import { lessons } from './share-image.ts';

test('share cards cover the lesson collection', () => {
  const collection = globSync('content/*/*/index.mdx').map((file) => relative('content', file).replace('/index.mdx', '')).sort();
  expect(lessons().map((lesson) => lesson.id).sort()).toEqual(collection);
});
