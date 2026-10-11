type Search = { where: string; rule: string; date: string; found: boolean | string; url?: string };
type Line = { kind: 'study' | 'other'; study?: number; verdict: string; wrong?: Record<string, string>; searched?: Search[] };
export type CheckRun = { maker: 'A' | 'B'; run: number; lines: Line[] };
const falsePart = (line: Line) => line.verdict === 'made-up-detail' || line.verdict === 'made-up-study';
const ordered = (runs: CheckRun[]) => [...runs].sort((a, b) => a.maker.localeCompare(b.maker) || a.run - b.run);
export function featured<T extends CheckRun>(runs: T[]): T | undefined {
  const candidates = ordered(runs) as T[];
  const fit = (r: T, checked: boolean) => {
    const studies = r.lines.filter((l) => l.kind === 'study').map((l) => l.study);
    return studies.length >= 1 && studies.length <= 3 && new Set(studies).size === studies.length &&
      r.lines.some(falsePart) && (!checked || studies.length === 3 && r.lines.some((l) => l.verdict === 'checked'));
  };
  return candidates.find((r) => fit(r, true)) ?? candidates.find((r) => fit(r, false)) ?? candidates[0];
}
const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const quantity = (n: number, total: number) => n === total ? 'every answer' : n === 0 ? 'no answer' : n === 1 ? 'one answer' : 'some answers';
// Brief T8: a run counts when it has at least one made-up detail or a study we could not find.
export const counted = (runs: CheckRun[], maker: 'A' | 'B') => runs.filter((r) => r.maker === maker && r.lines.some(falsePart)).length;
export function summary(runs: CheckRun[], a: string, b: string): string[] {
  const per = runs.filter((r) => r.maker === 'A').length;
  if (!per || runs.length !== 2 * per || !numbers[per] || !numbers[runs.length]) throw new Error('R-1.6 needs equal recorded runs from both makers');
  const count = (list: CheckRun[]) => list.filter((r) => r.lines.some((l) => l.verdict === 'made-up-detail')).length;
  const studies = runs.filter((r) => r.lines.some((l) => l.verdict === 'made-up-study')).length;
  return [
    `${numbers[per][0].toUpperCase()}${numbers[per].slice(1)} answers were recorded from each AI, ${numbers[runs.length]} in all.`,
    `From ${a}: ${quantity(count(runs.filter((r) => r.maker === 'A')), per)} had at least one made-up detail.`,
    `From ${b}: ${quantity(count(runs.filter((r) => r.maker === 'B')), per)} had at least one made-up detail.`,
    `${quantity(studies, runs.length)[0].toUpperCase()}${quantity(studies, runs.length).slice(1)} named a study we could not find.`,
  ];
}
export const inWords = (iso: string) => new Date(iso).toLocaleDateString('en-IE', { dateStyle: 'long', timeZone: 'UTC' });
const DETAILS = ['title', 'authors', 'year', 'journal'];
const list = (words: string[]) => words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0];
const wrongKeys = (line: Line) => DETAILS.filter((k) => line.wrong?.[k]);
export function verdictText(line: Line): string {
  const label = `Study ${line.study}`;
  const keys = wrongKeys(line);
  if (line.verdict === 'made-up-detail' && line.wrong?.authors) return `${label} is close to a real study, but the ${list(keys)} differ.`;
  return ({
    checked: `${label} is real, and every detail in it matched its record.`, 'made-up-detail': `${label} is real, but it has ${keys.length > 1 ? 'made-up details' : 'a made-up detail'}.`,
    'made-up-study': `We could not find ${label} where we searched.`, 'could-not-check': `${label} has a claim the linked record does not settle.`,
    'outside-the-request': `${label} is real, but it came out before 2020.`,
  } as Record<string, string>)[line.verdict] ?? 'This line names no study.';
}
// EMMI's decision: a study the searches did not find says so, where we looked and the date, and that a real study was found.
export function notFoundText(searched: Search[] = []): string {
  const titled = searched.some((s) => s.rule.startsWith('cited title'));
  const lead = titled ? 'We could not find this study.' : 'This citation gave no title. We could not find a study with its authors, year and journal.';
  return `${lead} On ${inWords(searched[0]?.date ?? '')}, we searched Crossref's top 20 results and the web for its ${titled ? 'exact title' : 'details'}. The same searches found a real study.`;
}
const VALUE: Record<string, string> = { title: 'title is', authors: 'authors are', year: 'year is', journal: 'journal is' };
export function checkText(line: Line): string {
  if (line.kind === 'other' && line.verdict === 'made-up-detail')
    return line.study ? `Checked: this line says Study ${line.study} is from 2020 or later, but its record says ${line.wrong?.year}.`
      : `Checked: this line says the studies are from 2020 or later, but one named study came out in ${line.wrong?.year}.`;
  if (line.kind === 'other' && line.verdict === 'could-not-check') return 'This line makes a wider claim that the linked source does not settle.';
  if (line.verdict === 'made-up-study') return notFoundText(line.searched);
  if (line.verdict === 'made-up-detail') {
    const keys = wrongKeys(line);
    const lead = line.wrong?.authors ? `a study with ${line.wrong.title ? 'a close' : 'this'} title exists` : 'this study exists';
    const values = keys.map((k, i) => `${i ? 'Its' : "The record's"} ${VALUE[k]} ${k === 'title' ? `“${line.wrong![k]}”` : line.wrong![k]}.`);
    return `Checked: ${lead}, but ${list(keys.map((k) => `its ${k}`))} ${keys.length > 1 || keys[0] === 'authors' ? 'do' : 'does'} not match the record. ${values.join(' ')}`;
  }
  return ({
    checked: 'Checked: a study with this title and these authors exists, and its year, journal and finding match its record.',
    'could-not-check': 'This line makes a claim that the linked source does not settle.',
    'outside-the-request': 'Checked: this study exists, but it came out before 2020, which the question did not ask for.', 'no-claim': 'This line names no study.',
  } as Record<string, string>)[line.verdict] ?? '';
}
