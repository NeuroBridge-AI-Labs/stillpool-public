// check:content. First target (lessons, `content`): the lesson schema, both layers in every section, alt text,
// glossed terms, verdicts, the map (map.yaml), the MDX allowlist, product names, PromptSage and R4's type and number rules. Other targets (the site's
// UI, `src`): the banned game mechanics, which never read lesson prose, where "40% of people" is a fact (R4), and
// what the interface never does or says. Every target: no stray Markdown page, no em-dash.
// --preview (what `verify` runs until launch): a provisional fact-check, or a pass with no review at the lesson's current
// hash, is listed on stdout, not refused (D10, p6 D5). `--hash <pillar>/<lesson> [lessons]` prints that hash (p6 D5),
// `--inputs` the files it covers (critic S5).
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { load } from 'js-yaml';
import { lessonFiles, lessonHash, lessonRules, OUT_OF_DATE, unfinal } from '../src/factcheck.ts';
import { lesson, map, recorded, recording, verdict } from '../src/lesson-schema.ts';

const [HASH, INPUTS] = ['--hash', '--inputs'].map((a) => process.argv.indexOf(a));
if (HASH > 0 || INPUTS > 0) {
  const [id, lessons = 'content'] = process.argv.slice(Math.max(HASH, INPUTS) + 1);
  console.log(HASH > 0 ? lessonHash(lessons, id) : lessonFiles(lessons, id).map(([path]) => path).join('\n'));
  process.exit(0);
}

const NAME = 'content';
const TEXT = /\.(?:astro|[cm]?[jt]sx?|mdx?|css|html|json|ya?ml|svg|txt)$/;
const LESSON = /^[^/]+\/[^/]+\/index\.mdx$/;
// .ts/.js/.tsx/.jsx (and .cjs/.mjs/.cts/.mts): the whole file is code, so a whole-line // there is always a comment.
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
// ponytail: none of these is interactive; one that is gets its props scanned for MECHANICS when it is added here.
// TryIt takes no props: it only places the lesson's own interactive (p6-2-review S1).
const ELEMENTS = ['Simple', 'Deep', 'img', 'TryIt'];
const PILLAR_2 = 'prompting/';
// Where PromptSage may be taught, under one set of rules: Pillar 2, and lessons 4.6 and 5.4, one layer each.
const PROMPTSAGE_LESSONS = ['using-ai-well/when-text-tricks-the-ai/', 'going-deeper/anatomy-of-a-skill-file/'];
const promptsageAllowed = (rel: string) => [PILLAR_2, ...PROMPTSAGE_LESSONS].some((p) => rel.startsWith(p));
const DISCLOSURE = 'Disclosure: PromptSage was created by Emanuel Covasa, who also created this site.';
// Longest first, so "NeuroBridge AI Labs" is not also reported as "NeuroBridge".
const NAMES = ['NeuroBridge AI Labs', 'NeuroBridgeEDU', 'NeuroBridge', 'ElectroSage', 'TaskSage', 'MathSage', 'NBEDU'];
// A space, hyphen, underscore or emphasis inside a compound name still matches: "Prompt Sage" and "Prompt**Sage**"
// are PromptSage (R2 M1, L3, N3).
const loose = (name: string) => name.replace(/([a-z])(?=[A-Z])/g, '$1[\\s_*-]*').replace(/ /g, '\\s+');
const NAMES_RE = new RegExp(`\\b(?:${NAMES.map(loose).join('|')})\\b`, 'gi');
const PROMPTSAGE = new RegExp(loose('PromptSage'), 'i');
const DASHES: [string, RegExp][] = [
  ['U+2014', new RegExp(String.fromCharCode(0x2014))], // built at runtime, so this file holds no literal one
  ['&mdash;', /&mdash;/],
  ['&#8212;', /&#0*8212;/],
  ['&#x2014;', /&#x0*2014;/i],
];
// ponytail: phrase patterns over source text, not a parser; the near-misses in fixtures/good/content stay quiet.
const MECHANICS: [string, RegExp][] = [
  ['streaks', /\bstreaks?\b/i],
  ['leaderboards', /\bleader ?boards?\b/i],
  ['timers', /\btimers?\b|\bcount ?down\b|\b(?:time|seconds|minutes) (?:left|remaining)\b/i],
  ['points', /\+ ?\d+ ?(?:points|pts)\b|\b(?:earn|win|won|gain|score)\w* (?:\d+ )?points\b/i],
  ['XP', /\bXP\b/i],
  ['levels', /\blevel ?up\b|\blevel \d+\b|\bnext level\b/i],
  ['percentages', /\d ?% ?(?:complete|done|finished|mastered)\b|\b(?:progress|complete|done)\W{0,3}\d+ ?%/i],
  ['x of y counts', /\b\d+ (?:of|out of) \d+\b|\} (?:of|out of) \{[^{}]*(?:length|size|count|total)\s*\}/i],
  ['lives', /\blives (?:left|remaining)\b|\b\d+ lives\b|\blose a life\b/i],
  ['lost on a break', /\b(?:lose|lost|losing|reset)\w* (?:all )?(?:your )?progress\b|\bprogress (?:will be |is )?(?:lost|reset)\b/i],
  ['notifications', /\bnotifications?\b|\bnotify\b/i],
  ['locked content', /\blocked\b|\bunlock/i],
  ['social comparison', /\b(?:better|faster|smarter) than (?:\d+ ?% of )?(?:other |most )?(?:learners|people|users|others|friends)\b|\btop \d+ ?%/i],
  ['daily goals', /\bdaily (?:goals?|targets?|challenges?)\b/i],
  ['confetti', /\bconfetti\b/i],
];
const LEARNING_STYLES = /\blearning[- ]styles?\b|\bspeed[- ]reading\b/i;
const CAPITALS = /\b[A-Z]+(?: [A-Z]+){2,}\b/; // three or more all-capital words in a row
// R4 sections 2.5 and 2.6, P3 and P19, on the UI only. Code and words both, so autoPlay and <LearningStyles /> are
// caught. ponytail: a call is `prompt(` with no space, so "Type a prompt (a question)" in copy is not one; a spaced
// call is left to the e2e guard's stubs.
const INTERFACE: [string, RegExp][] = [
  ['pop-ups', /\b(?:alert|confirm|prompt)\(|\bwindow\.open\s*\(|\bbeforeinstallprompt\b/],
  ['sound by default', /\bautoplay\b/i],
  ['badge counts', /\b\d+ badges?\b|\bbadges?:? ?\d+\b|\{[^{}]*(?:length|size|count|total)\s*\} badges?\b/i],
  ['learning styles or speed reading', LEARNING_STYLES],
  ['font claim', /\b(?:dyslexi[ac]|OpenDyslexic|Lexend)\b[^.!?]*\b(?:improves?|helps? you read|boosts?|proven|cures?)\b/i],
];
// R4 P2, [label, CSS declaration or markup, Tailwind class]: no italic, justified or all-capital text.
const TYPOGRAPHY: [string, RegExp, string][] = [
  ['italic', /font-style\s*:\s*italic|\bfont\s*:\s*(?:[a-z-]+\s+|\d{3}\s+){0,3}italic\b|<(?:em|i|cite|dfn|var|address)(?:[\s/][^>]*)?>/i, 'italic'],
  ['justify', /text-align\s*:\s*justify/i, 'text-justify'],
  ['uppercase', /text-transform\s*:\s*uppercase/i, 'uppercase'],
];
// pr2b-review NICE 2: Tailwind's important modifier, !x or x!, is layered, so it beats the reader's unlayered
// !important line spacing, spacing and font (src/styles/settings.css). Weight (!font-bold) is no reader setting, so only
// the family utilities count (fold-review NICE 2).
const READER_UTILITY = String.raw`(?:leading-|tracking-|font-(?:sans|serif|mono|\[|\())`;
const OVER_READER = new RegExp(String.raw`(?<![\w-])!${READER_UTILITY}|(?<![\w-])${READER_UTILITY}[^\s'"${'`'}{}]*!`);
// R4 P13: a percentage in a Simple layer also needs its words form in the same sentence.
const WORDS_FORM = /\b(?:in 10|in 100|about|roughly|around|half|nearly|almost|most)\b/i;
const PREVIEW = process.argv.includes('--preview');
// R4 P12 (Q14): a listed figurative or repurposed term in a Simple layer needs a glossary entry. A final e is dropped,
// so "hallucinate" also finds "hallucination" and "temperature" finds "temperatures".
const TERMS = ['hallucinate', 'black box', 'under the hood', 'token', 'training data', 'neural network', 'parameter', 'temperature', 'context window', 'embedding'];
const termRe = (term: string) => new RegExp(`\\b${term.replace(/e$/, '').replace(/ /g, '\\s+')}`, 'i');
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const cssText = (css: string) => [...css.matchAll(/\bcontent\s*:\s*([^;}]*)/g)].map(([, value]) => value).join('\n');

const findings: string[] = [];
const previews = new Set<string>();
const flag = (file: string, reason: string) => {
  const line = `${NAME}: ${file}: ${reason}`;
  if (!findings.includes(line)) findings.push(line);
};
const yaml = (file: string, text: string): unknown => {
  try {
    return load(text);
  } catch (e) {
    flag(file, `YAML: ${(e as Error).message.split('\n')[0]}`);
  }
};

// Pillar 2: every mark points at a variant, maker and run the recording holds, and a falseText is the reply's own words.
function markFindings(root: string, said: string, id: string, marks: { variant: string; maker: string; run: number; falseText?: string }[]) {
  if (!marks.length) return;
  const file = join(dirname(root), 'data/recorded', `${id}.json`);
  if (!existsSync(file)) return flag(said, `${id}: marks: no data/recorded/${id}.json`);
  let json: unknown;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { return flag(said, `${id}: marks: data/recorded/${id}.json is not JSON`); }
  const rec = recording.safeParse(json);
  if (!rec.success) return flag(said, `${id}: marks: data/recorded/${id}.json does not parse`);
  for (const m of marks) {
    const where = `${m.variant} (maker ${m.maker}) run ${m.run}`;
    const variant = rec.data.variants.find((x) => x.label === m.variant && x.maker === m.maker);
    const run = variant?.runs[m.run - 1];
    if (!variant) flag(said, `${id}: marks: no variant ${m.variant} for maker ${m.maker}`);
    else if (!run) flag(said, `${id}: marks: ${where} does not exist`);
    else if (m.falseText && ![run.reply, ...(run.replies ?? [])].some((r) => r.includes(m.falseText as string))) flag(said, `${id}: marks: falseText is not in the reply of ${where}`);
  }
}

function checkLesson(root: string, rel: string) {
  const text = readFileSync(join(root, rel), 'utf8');
  const [, front = '', body = text] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? [];
  const data = yaml(rel, front);
  const meta = lesson.safeParse(data);
  if (!meta.success) for (const i of meta.error.issues) flag(rel, [...i.path, i.message].join(': '));

  // MDX runs everything but fenced and inline code at build time, before any review (S1 M1).
  const prose = body.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
  if (/^\s*(?:import|export)\b/m.test(prose)) flag(rel, 'MDX import/export');
  if (/(?<!\\)[{}]/.test(prose)) flag(rel, 'MDX expression');
  for (const [, tag] of prose.matchAll(/<([A-Za-z][\w.:-]*)/g)) if (!ELEMENTS.includes(tag)) flag(rel, `element <${tag}> not allowed`);

  const sections = prose.split(/^## /m).slice(1);
  if (!sections.length) flag(rel, 'no ## sections');
  for (const s of sections)
    for (const layer of ['Simple', 'Deep']) if (!s.includes(`<${layer}>`)) flag(rel, `section "${s.split('\n', 1)[0].trim()}": missing <${layer}>`);
  // Only whitespace between a </Simple> and the next <Deep>; a line-anchored `## ` heading (a new section) or the end is the one exemption.
  // Code counts as something between (a CODE placeholder), but a tag written inside code is never read as a tag.
  const shown = body.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, 'CODE').replace(/`[^`\n]*`/g, 'CODE');
  if (/<\/Simple>\s*(?!<Deep>|(?<=\n)## |(?![\s\S]))\S/.test(shown)) flag(rel, 'something sits between a </Simple> and its <Deep>');
  const imgs = [...prose.matchAll(/<(?:img|Image)\b[^>]*>/g)].map(([tag]) => tag);
  if (/!\[\s*\](?:\(|\[)/.test(prose) || imgs.some((tag) => !/\balt\s*=\s*(["'])\s*[^\s"']/.test(tag))) flag(rel, 'image without alt text');
  if (text.includes('[UNSURE]')) flag(rel, '[UNSURE] marker');

  // R4 P2 and P13. A URL, bare or a link target, is not text, so its _x_ is not emphasis. Bold markers go first, so
  // ***x*** and **_x_** still read as italic; emphasis may span one line break, and * (never _) may sit inside a word.
  const em = prose.replace(/\]\([^)]*\)|https?:\/\/\S+/g, ' ').replace(/\*\*|__/g, '');
  if (/(?<![*\\])\*(?![\s*])(?:[^*\n]|\n(?!\s*\n))+?(?<!\s)\*|(?<![_\w\\])_(?![\s_])(?:[^_\n]|\n(?!\s*\n))+?(?<!\s)_(?![_\w])/.test(em))
    flag(rel, 'italic text');
  if (CAPITALS.test(prose)) flag(rel, 'capitals run');
  const simples = [...prose.matchAll(/<Simple>([\s\S]*?)<\/Simple>/g)].map(([, simple]): [string, string] => [rel, simple]);
  // p6 D4: what a person wrote about a recording is Simple text, and the interactive shows it, so no game words either.
  const said = join(dirname(rel), 'recorded.yaml');
  const raw = existsSync(join(root, said)) ? yaml(said, readFileSync(join(root, said), 'utf8')) : {};
  const rec = recorded.safeParse(raw ?? {});
  if (!rec.success) for (const i of rec.error.issues) flag(said, [...i.path, i.message].join(': '));
  for (const [id, entry] of rec.success ? Object.entries(rec.data) : []) markFindings(root, said, id, entry.marks ?? []);
  for (const [id, entry] of raw && typeof raw === 'object' ? Object.entries(raw) : []) {
    const summary = (entry as { summary?: unknown } | null)?.summary;
    if (typeof summary !== 'string') continue;
    // R3-N2: 1.4 plays R-1.1 piece by piece, 1.6 checks R-1.6 line by line, and 1.8 labels R-1.8's runs; each brief computes what it says by rule.
    if (summary === 'by rule') !['how-ai-works/the-next-word R-1.1', 'how-ai-works/why-they-make-things-up R-1.6', 'how-ai-works/attention-and-the-context-window R-1.8'].includes(`${dirname(rel)} ${id}`) && flag(said, `${id}: summary: by rule is for lesson 1.4's R-1.1, 1.6's R-1.6 and 1.8's R-1.8 only`);
    // 1.6: every note on a checked line, and on a study named inside it, is shown on the page, so it is Simple text too.
    type Note = { note?: unknown; related?: { note?: unknown }[] };
    const answers = (entry as { answers?: { lines?: Note[] }[] }).answers;
    const notes = [
      ...(Array.isArray(answers) ? answers : []).flatMap((a) => (Array.isArray(a.lines) ? a.lines : []).flatMap((l) => [l.note, ...(Array.isArray(l.related) ? l.related.map((r) => r.note) : [])])),
      ...list((entry as { marks?: unknown }).marks).map((m) => (m as Note).note), // Pillar 2: a mark's note is shown on the page too
    ].filter((n): n is string => typeof n === 'string');
    for (const words of [...(summary === 'by rule' ? [] : [summary]), ...notes]) {
      simples.push([said, words]);
      for (const [label, re] of MECHANICS) if (re.test(words)) flag(said, `banned game word (${label})`);
      if (CAPITALS.test(words)) flag(said, 'capitals run');
      if (words.includes('[UNSURE]')) flag(said, '[UNSURE] marker');
      for (const [name] of words.matchAll(NAMES_RE)) flag(said, `product name "${name}"`);
    }
  }
  for (const [file, simple] of simples)
    if (simple.split(/(?<=[.!?])\s+/).some((s) => s.includes('%') && !WORDS_FORM.test(s))) flag(file, 'percentage without words in Simple');
  const glossed = list((data as { glossary?: unknown } | undefined)?.glossary).map((g) => String((g as { term?: unknown })?.term));
  for (const term of TERMS)
    for (const [file] of simples.filter(([, s]) => termRe(term).test(s)))
      if (!glossed.some((g) => termRe(term).test(g))) flag(file, `term "${term}" needs a glossary entry`);
  // ponytail: fail-closed until Phase 9 adds the myth block these may appear in (R4 section 2.5).
  if (LEARNING_STYLES.test(text)) flag(rel, 'learning styles or speed reading outside a myth block');

  for (const [name] of body.matchAll(NAMES_RE))
    flag(rel, `product name "${NAMES.find((n) => new RegExp(`^${loose(n)}$`, 'i').test(name))}"`);
  if (/\bLearning is Fun\b/.test(body)) flag(rel, 'product name "Learning is Fun"');
  if (PROMPTSAGE.test(body)) {
    const deep = /<Deep>[\s\S]*?<\/Deep>/g;
    if (!promptsageAllowed(rel)) flag(rel, 'PromptSage outside Pillar 2');
    else if (PROMPTSAGE.test(body.replace(deep, ''))) flag(rel, 'PromptSage outside a Deep section');
    if (promptsageAllowed(rel) && body.match(deep)?.some((d) => PROMPTSAGE.test(d) && !d.includes(DISCLOSURE)))
      flag(rel, 'PromptSage without its disclosure line');
  }
  // A4 N5: these strings render outside the depth toggle, so a Simple reader sees them too.
  if (meta.success) {
    const { title, promise, badge, tldr, glossary, checkin, whereNext } = meta.data;
    const shared = [
      title, promise, badge.celebration,
      ...tldr,
      ...glossary.flatMap(({ term, meaning }) => [term, meaning]),
      ...checkin.flatMap(({ question, options }) => [question, ...options.flatMap(({ text, why }) => [text, why])]),
      whereNext.title, whereNext.text,
    ];
    if (shared.some((text) => PROMPTSAGE.test(text))) flag(rel, 'PromptSage in Simple-visible frontmatter');
  }

  const dir = dirname(rel);
  let hash = '';
  try {
    hash = lessonHash(root, dir); // every lesson, so a link is a finding before any pass
  } catch (e) {
    findings.push(`${NAME}: ${(e as Error).message}`);
  }
  for (const [file, reason] of lessonRules(root, dir)) flag(file, reason);
  const verdicts = globSync('verdicts/*.{yaml,yml}', { cwd: join(root, dir) }).sort();
  if (!verdicts.includes('verdicts/factcheck.yaml')) flag(rel, 'missing verdicts/factcheck.yaml');
  let approved = false;
  for (const v of verdicts) {
    const file = join(dir, v);
    const r = verdict.safeParse(yaml(file, readFileSync(join(root, file), 'utf8')));
    if (!r.success) for (const i of r.error.issues) flag(file, [...i.path, i.message].join(': '));
    else if (r.data.verdict !== 'pass' && !r.data.by) flag(file, 'by: a provisional or failed verdict names who wrote it');
    else if (r.data.verdict === 'provisional') {
      if (PREVIEW) previews.add(dir);
      else flag(file, 'verdict: provisional (not publishable)');
    } else if (r.data.verdict !== 'pass') flag(file, 'verdict: fail');
    else if (basename(v) === 'emanuel.yaml' && r.data.approvedBy === 'Emanuel') approved = true;
    else if (basename(v) === 'factcheck.yaml' && hash) checkPass(root, dir, hash);
  }
  // The raw flag, so a lesson that fails the schema for another reason still needs approval.
  if ((data as { signed?: unknown } | null | undefined)?.signed === true && !approved)
    flag(rel, 'signed: true needs verdicts/emanuel.yaml with verdict: pass and approvedBy: Emanuel');
}

// p6 D5: a pass is final only as src/factcheck.ts's unfinal() says; in --preview, out of date is a preview line.
function checkPass(root: string, dir: string, hash: string) {
  for (const [file, reason] of unfinal(root, dir, hash))
    if (PREVIEW && reason.startsWith(OUT_OF_DATE)) previews.add(`${dir} (fact-check out of date)`);
    else flag(file, reason);
}

// D9: the map's schema, then its membership, read from the raw file so it runs even when the schema fails.
function checkMap(root: string, lessons: string[]) {
  const file = 'map.yaml';
  let raw: unknown;
  try {
    raw = yaml(file, readFileSync(join(root, file), 'utf8'));
    const r = map.safeParse(raw);
    if (!r.success) for (const i of r.error.issues) flag(file, [...i.path, i.message].join(': '));
  } catch {
    flag(file, 'missing'); // one line: every lesson is then off the map anyway (R5 NICE 1)
  }
  const pillars = list(raw).map((p) => (p ?? {}) as { id?: unknown; topics?: unknown });
  const entries = pillars.flatMap(({ id, topics }) =>
    list(topics).flatMap((t) => list((t as { lessons?: unknown })?.lessons).map((slug) => `${id}/${slug}`)),
  );
  // The build keeps one pillar per id, so a second one drops a whole pillar from the map (pr5-review NICE 1).
  const twice = (l: unknown[]) => new Set(l.filter((x, i) => l.indexOf(x) !== i));
  for (const id of twice(pillars.map((p) => p.id))) flag(file, `pillar ${id} appears twice`);
  for (const entry of twice(entries)) flag(file, `${entry} appears twice`);
  const onMap = new Set(entries);
  const ids = new Set(lessons.map((f) => dirname(f)));
  for (const f of lessons) if (!onMap.has(dirname(f))) flag(f, 'not on the map');
  for (const id of onMap) if (!ids.has(id)) flag(file, `${id} is on the map but has no lesson`);
}

const args = process.argv.slice(2).filter((a) => a !== '--preview');
const roots = args.length ? args : ['content', 'src'];
for (const [i, root] of roots.entries()) {
  const files = globSync('**/*', { cwd: root }).filter((f) => TEXT.test(f)).sort();
  const lessons = files.filter((f) => LESSON.test(f));
  if (!(i === 0 ? lessons : files).length) {
    findings.push(`${NAME}: nothing to check in ${root}`);
    continue;
  }
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const [label, re] of DASHES) if (re.test(text)) flag(f, `em dash (${label})`);
    if (/\.mdx?$/.test(f) && !(i === 0 && LESSON.test(f))) flag(f, 'stray Markdown: only content/<pillar>/<lesson>/index.mdx is built and checked');
    if (i === 0) continue;
    // The UI's words, not its code (R2 M2, N1, N2): comments, whole-line // comments only, so "Speed // streak" in
    // copy is still read; class and id names; and CSS, which shows text only through `content:`, in a stylesheet
    // or a <style> block. Identifiers still read as words, so <DailyGoal /> is "Daily Goal".
    // R4 fix: // is a comment only inside a script file (whole file) or, in .astro/.mdx, inside the
    // frontmatter fence or a <script> block; a //-led line anywhere else in markup is rendered text and stays.
    const stripLineComments = (s: string) => s.replace(/^\s*\/\/.*$/gm, '');
    const noLineComments = SCRIPT_FILE.test(f)
      ? stripLineComments(text)
      : text.replace(/^---\n[\s\S]*?\n---\n|<script\b[^>]*>[\s\S]*?<\/script>/gi, stripLineComments);
    const code = noLineComments.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
    const ui = f.endsWith('.css')
      ? cssText(code)
      : code
          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => cssText(css))
          .replace(/\b(?:class(?:Name)?|id)\s*=\s*(?:"[^"]*"|'[^']*')/g, '');
    const words = ui.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
    for (const [label, re] of MECHANICS) if (re.test(words)) flag(f, `banned game word (${label})`);
    for (const [label, re] of INTERFACE) if (re.test(code) || re.test(words)) flag(f, `banned in the interface (${label})`);
    if (CAPITALS.test(ui)) flag(f, 'capitals run'); // ui, not words: a MAX_PARA_WORDS constant is one word there
    // class, className or Astro's class:list, quoted or an expression: the whole value is split into words, so a class
    // in a template string, an object key (class:list={{ uppercase: on }}), a variant (md:) and the important modifier
    // (italic!) all count.
    const values = [...code.matchAll(/\bclass(?::list|Name)?\s*=\s*("[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})/g)].map(([, v]) => v);
    const classes = values.flatMap((v) => v.split(/[\s'"`{}()[\],?:!$]+/));
    for (const [label, re, tw] of TYPOGRAPHY) if (re.test(code) || classes.includes(tw)) flag(f, `typography (${label})`);
    if (values.some((v) => OVER_READER.test(v))) flag(f, "typography (important over the reader's settings)");
  }
  if (i === 0) {
    for (const f of lessons) checkLesson(root, f);
    // p6-0-review S4 (R3-S2) and r2 SHOULD-FIX 4: every file under data/ is in some lesson's hash, a recording through its
    // recorded.yaml and anything else as an interactive's data or a listed input, whatever code reads it.
    const covered = new Set(lessons.flatMap((f) => { try { return lessonFiles(root, dirname(f)).map(([path]) => path); } catch { return []; } }));
    for (const f of globSync('data/**/*', { cwd: dirname(root) }))
      if (!basename(f).startsWith('.') && statSync(join(dirname(root), f)).isFile() && !covered.has(f)) flag(f, "no lesson's hash covers this file");
    checkMap(root, lessons);
  }
}

for (const id of previews) console.log(`${NAME}: preview only, not publishable: ${id}`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
