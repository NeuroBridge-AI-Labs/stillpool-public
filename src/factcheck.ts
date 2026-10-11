// D5, the fact-check gate (docs/plan/p6-plan.md, P6.0): a lesson is final only through a committed review file named
// after the hash of what it checked, whose last five lines name the writer and a checker of another model family. It
// is a record, not a proof. Its limits, three: nothing proves which model wrote a review; REVIEWED SHA is a record,
// never checked against history; and a forged review is a new file that looks like any other added file, unless
// check:reviews finds it is a copy of an old one.
import { createHash } from 'node:crypto';
import { existsSync, globSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { load } from 'js-yaml';

// ponytail: a fixed map, matched on whole tokens, so a new model family is a reviewed edit here and `gpt5` is no family.
const FAMILIES: Record<string, string[]> = {
  anthropic: ['claude', 'opus', 'sonnet', 'haiku', 'fable', 'anthropic'],
  openai: ['gpt', 'codex', 'openai'],
  moonshot: ['kimi', 'moonshot'],
  mistral: ['mistral', 'magistral', 'ministral'],
};
export const families = (name: string) => {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/);
  return Object.keys(FAMILIES).filter((f) => FAMILIES[f].some((t) => tokens.includes(t)));
};

const yaml = (file: string) => {
  try {
    const text = readFileSync(file, 'utf8');
    return (load(file.endsWith('.mdx') ? (/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '') : text) ?? {}) as Record<string, unknown>;
  } catch {
    return {}; // check:content reports the broken file; the hash still covers its bytes
  }
};
const posix = (from: string, to: string) => relative(from, to).split(sep).join('/');
export const pascal = (id: string) => id.replace(/(?:^|-)([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export const recordings = (dir: string) => Object.keys(yaml(join(dir, 'recorded.yaml'))).filter((r) => /^R-\d+\.\d+$/.test(r));

// One sha256 over what the learner reads: the lesson folder (not verdicts/, not dotfiles), each recording its
// recorded.yaml names, its interactive's own data and component (not the shared shell) and the inputs it lists. Each
// file is `<path>\0<length>\0<bytes>`, a named file that does not exist yet `<path>\0missing\0`; paths from the repo
// root (the folder above the lessons) with `/`, in byte order.
export function lessonFiles(lessons: string, id: string) {
  const repo = dirname(lessons);
  const dir = join(lessons, id);
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((f) => {
      // p6-0-review B1: readdir does not follow a link but the build does, so a link would keep its text out of the hash.
      if (f.isSymbolicLink()) throw new Error(`${posix(lessons, join(f.parentPath, f.name))}: a link in a lesson folder is outside the hash`);
      return f.isFile();
    })
    .map((f) => join(f.parentPath, f.name))
    .filter((f) => !posix(dir, f).split('/').some((s, i) => s.startsWith('.') || (i === 0 && s === 'verdicts')));
  for (const rec of recordings(dir)) files.push(join(repo, 'data/recorded', `${rec}.json`));
  const { interactive, inputs } = yaml(join(dir, 'index.mdx'));
  // p6-0-review S6: what else the learner sees comes from, as the lesson lists it (P6.3's src/lib/sort-messages.ts).
  // ponytail: a list, not an import walk, so an unlisted file is outside until review names it; walk imports if one slips.
  for (const f of Array.isArray(inputs) ? inputs : []) files.push(join(repo, String(f)));
  if (typeof interactive === 'string' && /^[a-z0-9-]+$/.test(interactive)) {
    files.push(join(repo, 'data/interactive', `${interactive}.json`), join(repo, 'src/components', `${pascal(interactive)}.astro`));
    files.push(...globSync(`data/interactive/${interactive}-*.json`, { cwd: repo }).map((f) => join(repo, f)));
  }
  return [...new Set(files)].map((f) => [posix(repo, f), f]).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
export function lessonHash(lessons: string, id: string) {
  const hash = createHash('sha256');
  for (const [path, file] of lessonFiles(lessons, id)) {
    if (!existsSync(file)) {
      hash.update(`${path}\0missing\0`);
      continue;
    }
    const bytes = readFileSync(file);
    hash.update(`${path}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest('hex');
}

export const reviewFile = (lessons: string, id: string, hash: string) => join(dirname(lessons), 'docs/factcheck', id, `${hash}.md`);

// The last five non-empty lines, each exact, or undefined.
const LAST = [/^WRITER: (\S+)$/, /^CHECKER: (\S+)$/, /^CHECKED: ([0-9a-f]{64})$/, /^REVIEWED SHA: ([0-9a-f]{40})$/, /^VERDICT: (PASS)$/];
export function readReview(text: string) {
  const lines = text.split('\n').filter((l) => l.trim()).slice(-LAST.length);
  const found = LAST.map((re, i) => re.exec(lines[i] ?? '')?.[1]);
  if (found.some((x) => x === undefined)) return undefined;
  const [writer, checker, checked, sha] = found as string[];
  return { writer, checker, checked, sha };
}

// p6-0-review S3, N2: a review is a regular file, never a link whose target can change after it was added, nor a folder.
export const regular = (file: string) => existsSync(file) && lstatSync(file).isFile();

// p6 D5: why a pass is not final, as [file, reason]; none is final. check:content flags each, and the page and its e2e
// spec ask final() (critic S4), so a review the gate refuses never hides the notice.
export const OUT_OF_DATE = 'factcheck is out of date';
// The rules check:content applies to every lesson, pass or not, that also make a pass not final (r2 SHOULD-FIX 3).
export function lessonRules(lessons: string, id: string) {
  const out: [string, string][] = [];
  const repo = dirname(lessons);
  // critic S3: the hash reads src/components/<PascalId>.astro, so a component by any other name would be outside it.
  const { interactive, inputs } = yaml(join(lessons, id, 'index.mdx'));
  const component = join(repo, 'src/components', `${pascal(String(interactive))}.astro`);
  if (typeof interactive === 'string' && !existsSync(component))
    out.push([`${id}/index.mdx`, `interactive ${interactive}: no src/components/${pascal(interactive)}.astro, so its text is outside the hash`]);
  // r2 SHOULD-FIX 4: a src/lib file the component imports is in the hash only when the lesson lists it under inputs:.
  // ponytail: the component's own relative imports, static or import() (p6-3-review N1), not a walk of what those files
  // import in turn; a bare specifier (a package) is not a src/lib file.
  else if (typeof interactive === 'string')
    for (const [, spec] of readFileSync(component, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      const file = posix(repo, join(dirname(component), spec));
      if (file.startsWith('src/lib/') && !(Array.isArray(inputs) && inputs.includes(file)))
        out.push([`${id}/index.mdx`, `inputs: ${file} is imported by ${pascal(interactive)}.astro but not listed`]);
    }
  // R3-S1: one reviewed commit has one hash, so two reviews of one REVIEWED SHA naming different hashes are a copy.
  const reviews = join(repo, 'docs/factcheck', id);
  const checked = new Map<string, string>();
  for (const f of existsSync(reviews) ? readdirSync(reviews).filter((f) => f.endsWith('.md') && regular(join(reviews, f))) : []) {
    const r = readReview(readFileSync(join(reviews, f), 'utf8'));
    if (r && checked.has(r.sha) && checked.get(r.sha) !== r.checked) out.push([`${posix(repo, reviews)}/`, `two reviews of REVIEWED SHA ${r.sha} name different hashes`]);
    if (r) checked.set(r.sha, r.checked);
  }
  return out;
}
export function unfinal(lessons: string, id: string, hash = lessonHash(lessons, id)) {
  const out = lessonRules(lessons, id);
  const v = `${id}/verdicts/factcheck.yaml`;
  const { provenance, interactive } = yaml(join(lessons, id, 'index.mdx')) as { provenance?: { model?: unknown }; interactive?: unknown };
  if (yaml(join(lessons, v)).by !== undefined) out.push([v, 'a pass names its checker in its review file, not in by:']);
  // p6-0-review S5: WhichReply reads R-1.1 by its path, so the exception ends when its lesson is final: R-1.1 in its hash.
  if (interactive === 'which-reply' && !recordings(join(lessons, id)).includes('R-1.1')) out.push([v, 'a final which-reply lesson names R-1.1 in its recorded.yaml']);
  if (interactive === 'made-up-answer' && !recordings(join(lessons, id)).includes('R-1.6')) out.push([v, 'a final made-up-answer lesson names R-1.6 in its recorded.yaml']);
  const path = reviewFile(lessons, id, hash);
  const shown = posix(dirname(lessons), path);
  if (!existsSync(path)) return [...out, [v, `${OUT_OF_DATE}: no review for ${id} at its current hash`]];
  if (!regular(path)) return [...out, [shown, 'a review is a regular file']];
  const r = readReview(readFileSync(path, 'utf8'));
  if (!r) return [...out, [shown, 'must end with WRITER, CHECKER, CHECKED, REVIEWED SHA and VERDICT: PASS lines']];
  if (r.checked !== hash) out.push([shown, 'CHECKED does not match its file name']);
  if (r.writer !== provenance?.model) out.push([shown, `WRITER ${r.writer} does not match provenance.model ${provenance?.model}`]);
  const [w, c] = [families(r.writer), families(r.checker)];
  for (const [role, name, f] of [['WRITER', r.writer, w], ['CHECKER', r.checker, c]] as const)
    if (f.length !== 1) out.push([shown, `${role} ${name} maps to ${f.length ? `${f.length} model families` : 'no model family'}`]);
  if (w.length === 1 && c.length === 1 && w[0] === c[0]) out.push([shown, `CHECKER ${r.checker} is the writer's model family (${w[0]})`]);
  return out;
}
export const final = (lessons: string, id: string) => yaml(join(lessons, id, 'verdicts/factcheck.yaml')).verdict === 'pass' && !unfinal(lessons, id).length;
