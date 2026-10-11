import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { lesson, pillar } from './lesson-schema.ts';

export const collections = {
  lessons: defineCollection({ loader: glob({ pattern: '*/*/index.mdx', base: './content' }), schema: lesson }),
  map: defineCollection({ loader: file('content/map.yaml'), schema: pillar }),
};
