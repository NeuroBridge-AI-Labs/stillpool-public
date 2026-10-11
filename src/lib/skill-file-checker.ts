// Lesson 5.4 "Skill-file checker": six rules of ours over the generic parts of a skill file (docs/packs/going-deeper/
// anatomy-of-a-skill-file.md, K8 to K32). Pure. The page runs it at build for the text version and again in the browser,
// and both draw the findings with `html`, so they cannot differ. A pass means the patterns are there, nothing more.
export type Status = 'present' | 'missing' | 'vague';
export type Finding = { part: string; status: Status; note: string };

export const PARTS = ['Name', 'Description', 'Steps', 'Rules', 'Examples', 'Reference files'] as const;
export const WORDS: Record<Status, string> = { present: 'Present', missing: 'Missing', vague: 'Vague' };

const line = (text: string, key: string) => text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))?.[1].trim();
const lines = (text: string) => text.split('\n');
const has = (re: RegExp, s: string) => re.test(s);

const name = (text: string): Finding => {
  const v = line(text, 'name');
  if (v === undefined) return { part: 'Name', status: 'missing', note: 'It has no name line.' };
  return has(/^[a-z0-9]+(-[a-z0-9]+)*$/, v)
    ? { part: 'Name', status: 'present', note: 'The name uses lowercase letters, numbers and single hyphens.' }
    : { part: 'Name', status: 'vague', note: 'The name should use only lowercase letters, numbers and single hyphens.' };
};

const description = (text: string): Finding => {
  const v = line(text, 'description');
  if (v === undefined) return { part: 'Description', status: 'missing', note: 'It has no description line.' };
  const short = v.split(/\s+/).filter(Boolean).length < 8;
  const noWhen = !has(/\bwhen\b/i, v);
  if (!short && !noWhen) return { part: 'Description', status: 'present', note: 'The description line has at least eight words and uses the word "when".' };
  const note = short && noWhen ? 'The description line has fewer than eight words and does not use the word "when".' : short ? 'The description line has fewer than eight words.' : 'The description line does not use the word "when".';
  return { part: 'Description', status: 'vague', note };
};

const steps = (text: string): Finding =>
  lines(text).filter((l) => has(/^\s*\d+[.)]\s/, l)).length < 2
    ? { part: 'Steps', status: 'missing', note: 'It has fewer than two numbered lines.' }
    : { part: 'Steps', status: 'present', note: 'It has at least two numbered steps.' };

const rules = (text: string): Finding => {
  const own = lines(text).filter((l) => has(/\b(never|always)\b/i, l));
  if (!own.length) return { part: 'Rules', status: 'missing', note: 'It has no always or never line.' };
  return own.every((l) => has(/\bbecause\b|\bso that\b/i, l))
    ? { part: 'Rules', status: 'present', note: 'Every always or never line gives a reason.' }
    : { part: 'Rules', status: 'vague', note: 'An always or never line gives no reason. Add "because" or "so that" and say why.' };
};

const examples = (text: string): Finding =>
  has(/^#+\s*Examples?\b/im, text) || (has(/^Input:/m, text) && has(/^Output:/m, text))
    ? { part: 'Examples', status: 'present', note: 'It has an Example heading, or an Input line and an Output line.' }
    : { part: 'Examples', status: 'missing', note: 'It has no Example heading, and no Input line with an Output line.' };

const references = (text: string): Finding => {
  const own = lines(text).filter((l) => !has(/^name:/, l) && has(/references\/|\.md/, l));
  if (!own.length) return { part: 'Reference files', status: 'present', note: 'It points to no other files, and a short file needs none.' };
  return own.every((l) => has(/\bwhen\b|\bif\b/i, l))
    ? { part: 'Reference files', status: 'present', note: 'Each pointer to another file says when to read it.' }
    : { part: 'Reference files', status: 'vague', note: 'A pointer to another file does not say when to read it.' };
};

export const check = (text: string): Finding[] => [name, description, steps, rules, examples, references].map((rule) => rule(text));
export const fails = (findings: Finding[]) => findings.some((f) => f.status !== 'present');
export const verdict = (findings: Finding[]) => (fails(findings) ? 'This file fails.' : 'This file passes.');

// The findings as a description list. Every string comes from this file, so nothing a learner types is ever put in the page.
export const html = (findings: Finding[]) =>
  findings.map((f) => `<dt>${f.part}</dt><dd data-status="${f.status}"><strong>${WORDS[f.status]}.</strong> ${f.note}</dd>`).join('');

// Three invented files, kept exactly as the lesson's writer set them (handoff C-anatomy-of-a-skill-file, 3d).
export const SAMPLES: { id: 'A' | 'B' | 'C'; text: string }[] = [
  {
    id: 'A',
    text: `---
name: Meeting Notes
description: Helps with notes.
---

# Meeting notes

Read the transcript and write good notes. Be careful and be clear.
Always keep the notes short.
Never make mistakes.
Think about who will read the notes and what they need from them.
Include the things people decided and the things people still have to do.
Leave out chatter that does not matter. Use a friendly tone, but not too friendly.
Check the notes once more before you finish. If anything seems wrong, fix it.`,
  },
  {
    id: 'B',
    text: `---
name: club-minutes
description: Writes minutes for a club meeting from a transcript.
---

# Club minutes

1. Read the whole transcript first.
2. List each decision in one line, with who made it.
3. List each task with an owner and a date.
4. Write the minutes under three headings: Decisions, Tasks, Questions.

## Rules

- Never invent a name, because the club will act on the minutes.
- Always write dates in full, so that nobody reads them wrongly.

## Example

Input: "Sam: I'll book the hall for 12 May."
Output: Task: book the hall. Owner: Sam. Date: 12 May.

Read references/headings.md if the club has its own headings.`,
  },
  {
    id: 'C',
    text: `---
name: source-check
description: Checks the sources in an article draft. Use this when a writer asks whether their links and quotes are right.
---

# Source check

1. Open each link and note whether it loads.
2. Find each quote on its source page and compare the words.
3. List every link or quote that does not match.

## Rules

- Never fix a quote yourself, because only the writer knows the meaning.
- Always list what you could not open, so that the writer can check it.

## Example

Input: A quote from a page that now says something different.
Output: Line 12: the page says "may help", the draft says "helps".

Read references/footnotes.md when the draft uses footnotes.`,
  },
];
