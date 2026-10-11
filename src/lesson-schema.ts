// One schema for the build (src/content.config.ts) and for check:content under plain Node.
import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { load } from 'js-yaml';
import { LABELS } from './lib/still-know-name.ts';

// The competency registry (Phase 2, R3). Read from the repo root: the build and every check run there.
type Competency = { id: string; framework: string; kind: string };
const registry = (load(readFileSync('docs/curriculum/competencies.yaml', 'utf8')) as { competencies: Competency[] }).competencies;
const ids = (keep: (c: Competency) => boolean) => new Set(registry.filter(keep).map((c) => c.id));
const COMPETENCIES = ids(() => true);
const UNESCO_BLOCKS = ids((c) => c.framework.startsWith('UNESCO') && c.kind === 'competency_block');
const HEA = ids((c) => c.framework.startsWith('HEA'));
// Known interactives, each added with its component, src/components/<PascalCase name>.astro.
const INTERACTIVES = ['which-reply', 'sort-the-messages', 'token-splitter', 'next-word', 'watch-it-learn', 'still-know-name', 'search-on-off', 'made-up-answer', 'feed-simulator', 'doodle-guesser', 'fix-the-bad-prompt', 'with-or-without-an-example', 'which-rule-wins', 'draft-change-check', 'shape-the-answer', 'skill-card-builder', 'hidden-characters', 'story-check', 'allowed-high-risk-or-banned', 'whats-at-stake', 'who-made-this', 'incident-casebook', 'energy-and-water', 'what-leaves-your-device', 'sort-the-dataset', 'source-checker', 'help-or-hand-in', 'will-the-detector-flag-it', 'read-the-small-print', 'stop-and-check', 'injection-spotter', 'split-the-task', 'same-text-your-way', 'good-fit-or-not', 'pipeline-stepper', 'keep-fix-or-switch-off', 'agent-stepper', 'skill-file-checker', 'find-then-answer', 'which-tool-for-the-job', 'local-or-cloud'];
const PERSON_PRAISE = /\b(?:genius|smart|brilliant|clever|gifted)\b/i;
// https only: no javascript:, data: or plaintext links; no user@host that hides the real host.
const https = z.url({ protocol: /^https$/ }).refine((u) => !URL.parse(u)?.username && !URL.parse(u)?.password, {
  message: 'no user or password in a URL',
});

// NC, ND, SA and unlicensed sources may be linked or cited, never adapted.
const ADAPTABLE = ['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause', 'public-domain'];

const source = z
  .object({
    title: z.string().min(1),
    url: https.optional(), // required, unless the source is unpublished
    unpublished: z.literal(true).optional(), // a paper not yet published, or Emanuel's own words: cited by title, no link
    licence: z.string().min(1),
    use: z.enum(['cite', 'link', 'adapt']),
    note: z.string().min(1).optional(), // a line the licence asks for, shown beside the source (p6-2-review S4)
  })
  .refine((s) => s.use !== 'adapt' || ADAPTABLE.includes(s.licence), {
    message: `only ${ADAPTABLE.join(', ')} sources may be adapted`,
  })
  .refine((s) => s.unpublished || s.url, { message: 'a source needs a url unless it is unpublished' })
  .refine((s) => !s.unpublished || !s.url, { message: 'an unpublished source has no url' })
  .refine((s) => !s.unpublished || s.use === 'cite', { message: 'an unpublished source can only be cited' });

// pillar and slug come from the entry id (content/<pillar>/<lesson>/index.mdx), never from frontmatter.
// strict: a typo such as `sigend: true` fails the build.
const text = z.string().min(1);
const option = z.object({ text, why: text, right: z.literal(true).optional() }).strict();
const question = z
  .object({ question: text, options: z.array(option).min(2) })
  .strict()
  .refine((q) => q.options.filter((o) => o.right).length <= 1, { message: 'at most one right option' });

// "Emanuel's take": one signed opinion piece, 80 to 150 words (bold marks not counted). Strict, and the literals are the
// approval: a take that names another author or lacks approvedBy fails here, in the build and in check:content alike.
const take = z
  .object({
    heading: text.optional(),
    paragraphs: z.array(text).min(1).max(5),
    by: z.literal('Emanuel Covasa'),
    position: z.enum(['after-checkin', 'after-in-short']).optional(),
    approvedBy: z.literal('Emanuel'),
  })
  .strict()
  .refine((t) => { const n = t.paragraphs.join(' ').replaceAll('**', '').trim().split(/\s+/).length; return n >= 80 && n <= 150; }, {
    message: 'a take is 80 to 150 words',
  });

// The lesson's anatomy (D4); the MDX body holds only the Core sections.
export const lesson = z
  .object({
    title: text,
    promise: text // also the badge: one "Can ..." sentence (spec 3.3)
      .refine((p) => p.startsWith('Can '), { message: 'must start with "Can "' })
      .refine((p) => p.split(/\s+/).length <= 20, { message: 'must be 20 words or fewer' }),
    minutes: z.object({ simple: z.int().positive(), deep: z.int().positive() }).strict(),
    tldr: z.array(text).length(3),
    misconceptions: z.array(z.enum(Array.from({ length: 12 }, (_, i) => `M${i + 1}`))).min(1),
    competencies: z
      .array(z.string().refine((id) => COMPETENCIES.has(id), { message: 'not in docs/curriculum/competencies.yaml' }))
      .min(1)
      .refine((l) => l.some((id) => UNESCO_BLOCKS.has(id)), { message: 'needs a UNESCO competency block' })
      .refine((l) => l.some((id) => HEA.has(id)), { message: 'needs an HEA id' }),
    checkin: z.array(question).min(1), // no score field: strict refuses one (D6)
    badge: z
      .object({
        earnedBy: z.array(text).min(1), // step ids: checkin-<n>, or the interactive's own
        celebration: text.refine((c) => !PERSON_PRAISE.test(c), { message: 'celebration praises the person' }),
      })
      .strict(),
    glossary: z.array(z.object({ term: text, meaning: text }).strict()),
    whereNext: z.object({ title: text, text, url: https.optional() }).strict(),
    interactive: z.string().refine((id) => INTERACTIVES.includes(id), { message: 'not a known interactive' }).optional(),
    // p6-0-review S6: the other files its interactive's output comes from (a src/lib engine, training text), in the hash.
    // A file name may hold dots (1.9's weights), never a `..` segment, and needs an extension (pack CR4).
    inputs: z.array(z.string().regex(/^(?:src\/(?:lib|components)|data)(?:\/[\w-]+)*\/[\w-]+(?:\.[\w-]+)*\.\w+$/, 'a file under src/lib, src/components or data')).optional(),
    sources: z.array(source).min(1),
    provenance: z.object({ model: text, date: z.date() }), // a YAML date, never null or 0
    take: take.optional(),
    signed: z.boolean(), // required: a forgotten flag must not skip Emanuel's approval
  })
  .strict()
  // A badge can be earned (pr5-review NICE 2): checkin-<n> is a question with a right option, n written as the page writes it.
  // ponytail: any other id passes once the lesson has an interactive; its own step ids are checked when the first one lands (Wave C).
  .superRefine((l, ctx) => {
    for (const step of l.badge.earnedBy) {
      const n = /^checkin-([1-9]\d*)$/.exec(step)?.[1];
      if (n ? !l.checkin[Number(n) - 1]?.options.some((o) => o.right) : l.interactive === undefined)
        ctx.addIssue({ code: 'custom', path: ['badge', 'earnedBy'], message: `${step} can never be earned` });
    }
    if (l.take && !l.signed) ctx.addIssue({ code: 'custom', path: ['signed'], message: 'a lesson with a take is signed: true' });
  });

// content/map.yaml (D9): pillars in order, each with topics of one to five lesson slugs. Strict, so a `locked` key
// fails (P15). Every lesson is on the map and every entry has a lesson: check:content.
const topic = z.object({ title: text, lessons: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(5) }).strict();
export const pillar = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: text, topics: z.array(topic).min(1) }).strict();
export const map = z.array(pillar).min(1);

export const verdict = z
  .object({
    verdict: z.enum(['pass', 'fail', 'provisional']), // provisional: never publishable, never an approval (D10)
    by: z.string().min(1).optional(), // a pass names its checker in its review file instead (p6 D5)
    approvedBy: z.literal('Emanuel').optional(),
    note: z.string().optional(),
  })
  .strict();

// data/recorded/<id>.json (T5.10, inventory section E), verbatim. The model, date and settings go on screen, so a file
// without them fails the build. It holds only what the recorder wrote (p6 D4). P6.11 widens it: a variant's own model
// and settings replace the file's (R-1.6's maker B), one variant is enough, and a run keeps its searches, citations and
// every call as sent and received (the 1.5, 1.6 and 1.8 briefs); R-1.8 keeps its cut in `trim`.
const model = z.object({ id: text, name: text, host: text, card: z.record(z.string(), z.json()).optional() }).strict();
const settings = z.record(text, z.json()).refine((s) => Object.keys(s).length > 0, { message: 'no settings' });
const call = z.object({ at: z.iso.datetime(), request: z.json(), response: z.json().optional(), error: z.object({ status: z.number(), category: z.literal('http_error') }).strict().optional() }).strict();
const run = z
  .object({
    reply: z.string(), // empty only with a finish_reason: a local model that stopped at once (R-5.1) is kept as it answered
    finish_reason: text.optional(),
    pieces: z.array(z.object({ text: z.string(), logprob: z.number() }).strict()).optional(),
    searches: z.array(z.string()).optional(),
    citations: z.array(z.object({ url: z.string(), title: z.string().nullable(), cited_text: z.string() }).strict()).optional(),
    usage: z.record(z.string(), z.json()).optional(),
    replies: z.array(text).optional(), // a multi-turn run: every turn's reply, in order; `reply` is the last
    calls: z.array(call).optional(),
  })
  .strict()
  .refine((r) => r.reply || r.finish_reason, { message: 'an empty reply needs its finish_reason', path: ['reply'] });
export const recording = z
  .object({
    id: z.string().regex(/^R-\d+\.\d+$/),
    message: text.optional(), // invented (section E rule 4), byte-identical in every run; an R-2 file has each variant's own `messages` instead
    model,
    date: z.iso.date(),
    settings,
    trim: z.record(z.string(), z.json()).optional(),
    variants: z.array(z.object({
      instruction: text.optional(), model: model.optional(), settings: settings.optional(), runs: z.array(run).min(1),
      // R-2: what this variant sent (the user turns, and the system prompt if any) and which maker answered.
      label: text.optional(), maker: z.enum(['A', 'B']).optional(), system: text.optional(),
      messages: z.array(z.object({ role: z.literal('user'), content: text }).strict()).min(1).optional(),
    }).strict()).min(1),
  })
  .strict()
  .refine((r) => r.message || r.variants.every((x) => x.label && x.maker && x.messages), { message: 'no message: every variant needs label, maker and messages' })
  .refine((r) => r.id !== 'R-1.1' || (r.variants.length === 2 && r.variants.every((v) => v.instruction)), { message: 'R-1.1 needs two instructed variants' });
// content/<pillar>/<lesson>/recorded.yaml (p6 D4): each recording the lesson uses, with what a person wrote after
// reading every run. check:content and check:readability read it as lesson text.
// 1.8's R-1.8 (its brief, the recorded.yaml entry): when and by whom each run was labelled, and its one label (pack R9).
const runLabel = z.object({ run: z.int().positive(), answer: z.enum(LABELS) }).strict();
const searchCheck = z.object({
  year: z.number().int().nullable(), searchRan: z.boolean(), winnerMatch: z.boolean(), scoreMatch: z.boolean(),
  falseText: text.optional(), reason: text.optional(),
  citations: z.array(z.object({ loads: z.boolean(), supports: z.boolean() }).strict()),
}).strict();
// 1.6's R-1.6 (EMMI's decision, 28-09-26): each cited study is found, found but different, or not found after dated searches.
const RESULTS = ['found', 'found-but-different', 'not-found'] as const;
const searched = z.array(z.object({ where: text, rule: text, date: z.iso.date(), found: z.union([z.boolean(), text]), doi: text.optional(), url: https.optional() }).strict());
const checkedLine = z.object({
  line: z.int().positive(), study: z.int().positive().optional(), result: z.enum(RESULTS).optional(),
  kind: z.enum(['study', 'other']), verdict: z.enum(['checked', 'made-up-detail', 'made-up-study', 'could-not-check', 'outside-the-request', 'no-claim']),
  wrong: z.record(z.string(), text).optional(), doi: text.optional(), resolves: z.boolean().optional(), searched: searched.optional(),
  related: z.array(z.object({ result: z.enum(RESULTS), note: text, searched: searched.optional() }).strict()).optional(),
  note: text.optional(),
}).strict().superRefine((l, ctx) => {
  if (l.kind === 'study' && !l.study) ctx.addIssue({ code: 'custom', path: ['study'], message: 'study label required' });
  if (l.kind === 'study' && !l.result) ctx.addIssue({ code: 'custom', path: ['result'], message: 'study result required' });
  // A check links the record it rests on or the searches we ran; nothing is labelled a quote (p6-15-review S1).
  if (l.verdict !== 'no-claim' && !l.doi && !l.searched?.length) ctx.addIssue({ code: 'custom', path: ['doi'], message: 'record or search required' });
  if (['checked', 'made-up-detail', 'could-not-check', 'outside-the-request'].includes(l.verdict) && l.kind === 'study' && !l.doi)
    ctx.addIssue({ code: 'custom', path: ['doi'], message: 'study record required' });
  if (l.verdict === 'made-up-detail' && !Object.keys(l.wrong ?? {}).length) ctx.addIssue({ code: 'custom', path: ['wrong'], message: 'wrong detail required' });
});
// checked: R-1.8 writes a YAML date, R-1.5 and R-1.6 a quoted ISO date string; both parse to the ISO string.
// Pillar 2: one mark per run worth saying something about; `shows` is whether that run showed the effect the lesson names.
const mark = z.object({
  variant: text, maker: z.enum(['A', 'B']), run: z.int().positive(), shows: z.boolean(), note: text, falseText: text.optional(), reason: text.optional(),
}).strict().refine((m) => !m.falseText || m.reason, { message: 'falseText needs a reason', path: ['reason'] });
const said = z.object({
  summary: text,
  checked: z.union([z.date().transform((d) => d.toISOString().slice(0, 10)), z.iso.date()]).optional(),
  by: text.optional(),
  runs: z.array(runLabel).min(1).optional(),
  recordingSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checkedBy: text.optional(),
  cutoff: text.optional(),
  truth: z.object({ winner: text, score: text, date: text, weekday: text, place: text, source: https, previous: text }).strict().optional(),
  checks: z.array(z.array(searchCheck).length(3)).length(2).optional(),
  answers: z.array(z.object({ maker: z.enum(['A', 'B']), run: z.int().positive(), lines: z.array(checkedLine).min(1) }).strict()).optional(),
  marks: z.array(mark).min(1).optional(),
}).strict();
export const recorded = z.record(z.string().regex(/^R-\d+\.\d+$/), said).superRefine((all, ctx) => {
  const r = all['R-1.6'];
  if (r && (!r.checked || !r.by || !r.answers?.length)) ctx.addIssue({ code: 'custom', path: ['R-1.6'], message: 'dated checks required' });
});
// Fact-check S2 (28-09-26): R-1.1 omitted temperature, which does not show the value the service used. The stored line is
// never edited (D4), so it is reworded where it shows.
const SHOWN: Record<string, string> = { "not set, so the model's default": 'not sent, and the value the service used was not recorded' };
export const shownSetting = (value: unknown) => SHOWN[String(value)] ?? String(value);
