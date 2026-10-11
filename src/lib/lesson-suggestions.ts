// Type-ahead for /search/ (F9): the lessons whose title has a run of words that start with the typed words, "it" and "ite"
// finding "Iterate and check" but never a middle of a word. Lessons whose whole title starts with them come first; the rest
// keep the map's order. Case and accents do not matter. Pure, so the browser script and its test share it.
export type Lesson = { id: string; title: string; url: string; number?: string; pillar?: string };

const words = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export const suggest = (query: string, lessons: Lesson[], limit = 6): Lesson[] => {
  const typed = words(query);
  if (!typed.length) return [];
  const start = (title: string) => {
    const t = words(title);
    return t.findIndex((_, i) => typed.every((q, j) => t[i + j]?.startsWith(q)));
  };
  const hits = lessons.map((lesson) => ({ lesson, at: start(lesson.title) })).filter(({ at }) => at >= 0);
  return [...hits.filter(({ at }) => at === 0), ...hits.filter(({ at }) => at > 0)].slice(0, limit).map(({ lesson }) => lesson);
};
