export type SearchCheck = {
  year: number | null; searchRan: boolean; winnerMatch: boolean; scoreMatch: boolean;
  falseText?: string; reason?: string; citations: { loads: boolean; supports: boolean }[];
};
export function checkLine(on: boolean, check: SearchCheck, year: number): string {
  if (!on) {
    if (check.year === null) return 'This answer did not name a final.';
    if (check.year === year) return `This answer named the ${year} final. Its training data stops before that final, so check it again.`;
    return `This answer gave the ${check.year} final as the most recent.`;
  }
  if (!check.searchRan) return 'No search ran for this answer, so it had no web pages to go on.';
  if (check.year !== year) return check.year === null ? 'This answer searched but did not name a final.' : `This answer searched and still gave the ${check.year} final.`;
  if (!check.winnerMatch) return `This answer gave the ${year} final, but its winner does not match GAA.ie.`;
  return check.winnerMatch && check.scoreMatch
    ? `This answer gave the ${year} final, and its winner and score match GAA.ie.`
    : `This answer gave the ${year} final, and its score does not match GAA.ie.`;
}
export function citationLine(c: { loads: boolean; supports: boolean }): string {
  if (!c.loads && c.supports) throw new Error('A page that did not load cannot support a claim');
  return !c.loads ? 'This page no longer loads.' : c.supports ? 'This page says what the answer says it says.' : 'This page does not say what the answer says it says.';
}
export function searchOutcomes(calls: { response?: unknown }[]): { query: string; result: 'pages' | 'empty' | 'error' }[] {
  const blocks = calls.flatMap(c => ((c.response as { content?: any[] } | undefined)?.content ?? []));
  return blocks.filter(b => b.type === 'server_tool_use' && b.name === 'web_search').map(use => {
    const matches = blocks.filter(b => b.type === 'web_search_tool_result' && b.tool_use_id === use.id);
    if (matches.length !== 1 || typeof use.input?.query !== 'string') throw new Error('Search has no single matching result');
    const content = matches[0].content;
    if (Array.isArray(content)) return { query: use.input.query, result: content.length ? 'pages' : 'empty' };
    if (content?.type === 'web_search_tool_result_error' && ['too_many_requests', 'invalid_tool_input', 'max_uses_exceeded', 'query_too_long', 'request_too_large', 'unavailable'].includes(content.error_code))
      return { query: use.input.query, result: 'error' };
    throw new Error('Search result cannot be settled');
  });
}
export function searchSummary(checks: SearchCheck[][], year: number): string {
  const say = (runs: SearchCheck[], yes: (c: SearchCheck) => boolean) => {
    const n = runs.filter(yes).length;
    return n === 0 ? 'no run' : n === runs.length ? 'every run' : 'some runs';
  };
  const [off, on] = checks;
  const sentence = (words: string) => words[0].toUpperCase() + words.slice(1);
  const failed = say(on, c => c.citations.some(x => x.loads && !x.supports));
  return `Three runs with search off and three with search on were recorded. With search off, ${say(off, c => c.year === year)} gave the ${year} final.\n\nWith search on, a search ran in ${say(on, c => c.searchRan)}. ${sentence(say(on, c => c.year === year && c.winnerMatch && c.scoreMatch))} gave the ${year} final with a matching score. ${failed === 'no run' ? 'No checked cited page failed to back up its attached claim.' : `The check found a cited page that did not back up the answer in ${failed}.`}`;
}
