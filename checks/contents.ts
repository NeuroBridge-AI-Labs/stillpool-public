// check:contents (Emanuel, 27-09-26). The contents on / come from the signed lesson list (src/contents.ts). Under each
// <target> root that read must give five pillars, each with its folder, and 41 lessons numbered in order; and every
// lesson folder must carry a signed title of its own pillar, or the contents would show a built lesson as coming later.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { LIST, readContents } from '../src/contents.ts';

const NAME = 'contents';
const findings: string[] = [];
for (const root of process.argv.length > 2 ? process.argv.slice(2) : ['.']) {
  const flag = (reason: string) => findings.push(`${NAME}: ${reason}`);
  if (!existsSync(join(root, LIST))) {
    flag(`nothing to check in ${root}`);
    continue;
  }
  const pillars = readContents(root);
  const count = pillars.flatMap((p) => p.lessons).length;
  if (pillars.length !== 5) flag(`${pillars.length} pillars, the signed list has 5`);
  if (count !== 41) flag(`${count} lessons, the signed list has 41`);
  pillars.forEach((p, i) => {
    if (!p.slug) flag(`pillar ${i + 1} has no folder slug`);
    p.lessons.forEach((l, j) => l.n !== `${i + 1}.${j + 1}` && flag(`${l.n} ${l.title} is out of order, expected ${i + 1}.${j + 1}`));
  });
  for (const file of globSync('content/*/*/index.mdx', { cwd: root }).sort()) {
    const slug = file.split('/')[1];
    const { title } = load(readFileSync(join(root, file), 'utf8').split('---')[1]) as { title?: string };
    if (!pillars.find((p) => p.slug === slug)?.lessons.some((l) => l.title === title))
      flag(`${file}: title '${title}' is not a signed lesson of ${slug}`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
