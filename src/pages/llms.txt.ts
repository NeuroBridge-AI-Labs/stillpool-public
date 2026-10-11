import { readFileSync } from 'node:fs';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { load } from 'js-yaml';

const HOST = 'https://learn.neurobridgeedu.eu';

// llmstxt.org shape, written from the map so the counts and the lesson list cannot drift.
export const GET: APIRoute = async () => {
  const order = (load(readFileSync('content/map.yaml', 'utf8')) as { id: string }[]).map((p) => p.id);
  const pillars = (await getCollection('map')).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const lessons = new Map((await getCollection('lessons')).map((l) => [l.id, l]));
  const sections = pillars.map((p) => {
    const items = p.data.topics.flatMap((t) => t.lessons).map((slug) => {
      const l = lessons.get(`${p.id}/${slug}`);
      if (!l) throw new Error(`content/map.yaml: ${p.id}/${slug} is on the map but has no lesson`);
      return `- [${l.data.title}](${HOST}/learn/${l.id}/): After this lesson you ${l.data.promise.replace(/\.$/, '').replace(/^C/, 'c')}.`;
    });
    return `## ${p.data.title}\n\n${items.join('\n')}`;
  });
  const body = `# Stillpool

> Stillpool is a free AI literacy course by NeuroBridgeEDU: ${lessons.size} short lessons in ${pillars.length} topics. No account, no cookies, no adverts. Lessons are licensed CC BY-NC-SA 4.0.

Each lesson has a Simple layer and an optional Deep layer, and reads without JavaScript.

${sections.join('\n\n')}

## Optional

- [About Stillpool](${HOST}/about/)
- [For teachers](${HOST}/teachers/)
- [Practice lab](${HOST}/lab/)
- [Feedback](${HOST}/feedback/)
- [Licences and credits](${HOST}/licences/)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
