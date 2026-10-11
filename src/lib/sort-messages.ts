// Lesson 1.2's "Sort the messages" (its brief, Interactive), run at build time: the page gets only each message's group
// from the written rule and from a word-counting model (multinomial naive Bayes, add-one smoothing), never a chance.
import { z } from 'astro/zod';

const item = z.object({ text: z.string().min(1), junk: z.boolean() }).strict();
// Inputs only, strict, so no result can be typed into the file.
export const sortData = z.object({ rule: z.string().regex(/^[a-z]+$/), examples: z.array(item).min(2), messages: z.array(item).length(5) }).strict();
type Data = z.infer<typeof sortData>;

// Lower case, and each run of the letters a to z is one word, for the rule and the model alike.
const words = (text: string): string[] => text.toLowerCase().match(/[a-z]+/g) ?? [];

export function sortMessages({ rule, examples, messages }: Data) {
  const vocab = new Set(examples.flatMap((e) => words(e.text)));
  const group = (junk: boolean) => {
    const own = examples.filter((e) => e.junk === junk);
    const counts = new Map<string, number>();
    for (const w of own.flatMap((e) => words(e.text))) counts.set(w, (counts.get(w) ?? 0) + 1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    // Its share of the examples, then each known word's (count + 1) / (all its words + every different word).
    return (text: string) =>
      Math.log(own.length / examples.length) +
      words(text).filter((w) => vocab.has(w)).reduce((sum, w) => sum + Math.log(((counts.get(w) ?? 0) + 1) / (total + vocab.size)), 0);
  };
  const [junk, notJunk] = [group(true), group(false)];
  // A tie goes to not junk.
  return messages.map((m) => ({ ...m, rule: words(m.text).includes(rule), model: junk(m.text) > notJunk(m.text) }));
}
