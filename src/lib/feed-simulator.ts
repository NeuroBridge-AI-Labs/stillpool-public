// Lesson 1.10's Feed simulator runs the places rule, ten opens and controls at build time.
import { z } from 'astro/zod';

const id = z.string().regex(/^[a-z]+$/);
const title = z.string().regex(/^\D+$/, 'no digit').refine((t) => t.split(' ').length >= 2 && t.split(' ').length <= 8, '2 to 8 words');
const ids = (items: Record<string, string[]>) => Object.entries(items).flatMap(([t, list]) => list.map((_, i) => `${t}-${i + 1}`));
export const feedData = z
  .object({
    places: z.literal(5), opens: z.literal(10), items: z.record(id, z.array(title).min(3)), newest: z.array(z.string()),
    topics: z.array(z.object({ id, name: z.string().min(1), shape: z.enum(['circle', 'square', 'triangle', 'diamond', 'hexagon']) }).strict()).length(5),
  })
  .strict()
  .refine((d) => new Set(d.topics.map((t) => t.id)).size === 5 && new Set(d.topics.map((t) => t.shape)).size === 5, 'five topics, five shapes')
  .refine((d) => d.topics.map((t) => t.id).join() === Object.keys(d.items).join(), 'items by topic, in order')
  .refine((d) => [...d.newest].sort().join() === ids(d.items).sort().join(), 'newest lists every item once');
type Data = z.infer<typeof feedData>;

// Largest remainder on whole numbers; ties go to the topic first in the data's order.
export function share(weights: number[], places: number) {
  const total = weights.reduce((s, w) => s + w);
  const got = weights.map((w) => Math.floor((places * w) / total));
  const left = places - got.reduce((s, g) => s + g);
  const byRemainder = weights.map((_, i) => i).sort((a, b) => ((places * weights[b]) % total) - ((places * weights[a]) % total) || a - b);
  return got.map((g, i) => g + Number(byRemainder.indexOf(i) < left));
}

const feed = (d: Data, counts: number[], opened: Set<string>) => {
  const weights = counts.map((c) => c + 1);
  const places = share(weights, d.places);
  return d.topics.map((_, i) => i).sort((a, b) => weights[b] - weights[a] || a - b).flatMap((i) => {
    const t = d.topics[i].id;
    const unseen = d.items[t].map((_, n) => `${t}-${n + 1}`).filter((x) => !opened.has(x));
    if (unseen.length < places[i]) throw new Error(`${t} has fewer unseen items than places`);
    return unseen.slice(0, places[i]);
  });
};
export function control(d: Data, c: 'none' | 'less' | 'again' | 'newest', counts: number[], opened: Set<string>, top = 0) {
  if (c === 'newest') return d.newest.filter((x) => !opened.has(x)).slice(0, d.places);
  return feed(d, counts.map((n, i) => (c === 'again' ? 0 : c === 'less' && i === top ? Math.floor(n / 2) : n)), opened);
}

export const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const topicOf = (x: string) => x.replace(/-\d+$/, '');
const present = (d: Data, xs: string[]) => d.topics.map((t) => t.id).filter((t) => xs.some((x) => topicOf(x) === t));
// ponytail: compared by how many topics, which is all the three lines say; same count, other topics reads "The same".
export const compare = (now: string[], before: string[], than = 'before') =>
  now.length < before.length ? `Fewer topics than ${than}.` : now.length > before.length ? `More topics than ${than}.` : `The same topics as ${than}.`;
export const topicsLine = (d: Data, topics: string[]) => `Topics in the feed: ${d.topics.filter((t) => topics.includes(t.id)).map((t) => t.name).join(', ')}.`;
export const mostly = (d: Data, xs: string[]) => {
  const t = d.topics.find((t) => xs.filter((x) => topicOf(x) === t.id).length >= 3);
  return t && `The feed ended up with mostly one topic: ${t.name}.`;
};

export function feedSimulator(d: Data) {
  const counts = d.topics.map(() => 0);
  const opened = new Set<string>();
  const states = [feed(d, counts, opened)];
  for (let k = 0; k < d.opens; k++) {
    opened.add(states[k][0]);
    counts[d.topics.findIndex((t) => t.id === topicOf(states[k][0]))]++;
    states.push(feed(d, counts, opened));
  }
  const tenth = states[d.opens];
  const top = d.topics.findIndex((t) => t.id === topicOf(tenth[0]));
  const withWords = (xs: string[], k: number) => {
    const topics = present(d, xs);
    const words = k ? [`After the ${ORDINALS[k - 1]} open.`, compare(topics, present(d, states[k - 1]))] : ['The start. Every topic has one place.'];
    return { ids: xs, topics, words: [...words, topicsLine(d, topics)] };
  };
  const controls = ([
    ['none', 'No control', 'The feed after the tenth open.'],
    ['less', `Show less of ${d.topics[top].name}`, `The toy now counts half of your ${d.topics[top].name} opens.`],
    ['again', 'Start again', 'The toy now counts none of your opens, so every topic has one place again.'],
    ['newest', 'Newest first', 'The toy now uses none of your opens. It shows the newest items, whatever their topic.'],
  ] as const).map(([c, label, line]) => {
    const xs = control(d, c, counts, opened, top);
    const topics = present(d, xs);
    return { control: c, label, ids: xs, topics, words: [line, ...(c === 'none' ? [] : [compare(topics, present(d, tenth), 'after the tenth open')]), topicsLine(d, topics)] };
  });
  const cards = Object.fromEntries(d.topics.flatMap((t) => d.items[t.id].map((title, n) => [`${t.id}-${n + 1}`, { topic: t.id, name: t.name, shape: t.shape, title }])));
  return { states: states.map(withWords), controls, cards, mostly: mostly(d, tenth) };
}
