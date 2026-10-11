// The contents on / (Emanuel, 27-09-26) read from the signed lesson list at build time, so the page shows each
// lesson's number and title exactly as signed and cannot drift from it. check:contents holds this read to the list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LIST = 'docs/curriculum/lesson-list.md';
export type Pillar = { title: string; slug?: string; lessons: { n: string; title: string }[] };

export const readContents = (root = '.'): Pillar[] => {
  const text = readFileSync(join(root, LIST), 'utf8');
  // Each pillar's folder, from its detail heading: "### 1️⃣ Pillar 1 detail: How AI works (`how-ai-works`)".
  const slugs = Object.fromEntries([...text.matchAll(/^### .*Pillar (\d+) detail: [^(\n]*\(`([a-z0-9-]+)`\)/gm)].map((m) => [m[1], m[2]]));
  const pillars: Pillar[] = [];
  for (const line of (text.split('\n## 📋 The 41 lessons')[1] ?? '').split('\n## ')[0].split('\n')) {
    const pillar = /^### \S+ (.+)$/.exec(line)?.[1];
    if (pillar) pillars.push({ title: pillar, slug: slugs[pillars.length + 1], lessons: [] });
    const row = /^\| (\d+\.\d+) \| ([^|]+?) \|/.exec(line);
    if (row) pillars.at(-1)?.lessons.push({ n: row[1], title: row[2] });
  }
  return pillars;
};

// A built lesson's signed number ("1.4"), matched by its pillar folder and title, as the outline matches its links.
export const numbers = (built: { id: string; data: { title: string } }[]) =>
  new Map(
    readContents().flatMap(({ slug, lessons }) =>
      lessons.flatMap(({ n, title }) => {
        const id = built.find((l) => l.id.split('/')[0] === slug && l.data.title === title)?.id;
        return id ? [[id, n] as const] : [];
      }),
    ),
  );
