// 2.5's layer explorer (stage I, the Deep layer): eight rules from an invented study-helper prompt. The reader picks a
// PromptSage layer for each, then sees the same prompt built layer by layer. Invented: no model answered it. The layer
// names are the paper's own, in its US spelling. Nothing here scores a choice.
export const LAYERS = ['Immutable Security Boundary', 'Identity', 'Core Directives', 'Mode Control', 'Behavioral Protocols', 'Customizable Defaults', 'Sandwich Reinforcement'];

export const RULES = [
  { rule: "Never share another student's private details.", layer: 1, reason: 'A safety rule that comes first and outranks the rest. No prompt can make it truly unbreakable.' },
  { rule: 'You are a study helper for first-year students. You are not a tutor who writes their essays.', layer: 2, reason: 'It says who the helper is, and what it is not.' },
  { rule: 'If a request clashes with a rule here, follow the rule and say which rule stopped you.', layer: 3, reason: 'It says what wins when rules clash.' },
  { rule: 'Quiz mode: ask one question at a time. Do not show the answer until the student has tried.', layer: 4, reason: 'It is one job, with what it may and may not do.' },
  { rule: 'Before you send an answer, check it against these rules. If you are unsure, say so.', layer: 5, reason: 'It is a habit the helper runs every time.' },
  { rule: 'Answer in the language the student writes in.', layer: 6, reason: 'It is a setting a user may change.' },
  { rule: 'Unless the student asks otherwise, use plain words, short sentences and a short list.', layer: 6, reason: 'It is a default for style and length, which a user may change.' },
  { rule: 'Remember: never share private details, and never write their essays for them.', layer: 7, reason: 'It repeats the most important rules at the very end.' },
] as const;

export const named = (layer: number) => `Layer ${layer}, ${LAYERS[layer - 1]}`;

// Every rule has a choice: a layer from 1 to 7.
export const ready = (picks: string[]) => picks.length === RULES.length && picks.every((p) => /^[1-7]$/.test(p));

// Each rule with its layer and reason, and what the reader chose, in words.
export const check = (picks: string[]) =>
  RULES.map((r, i) => ({ ...r, yours: Number(picks[i]) === r.layer ? 'You chose this layer.' : `You chose layer ${picks[i]}.` }));

// The prompt built layer by layer: each layer's name, then its rules.
export const built = () =>
  LAYERS.map((_, i) => `${named(i + 1)}\n${RULES.filter((r) => r.layer === i + 1).map((r) => r.rule).join('\n')}`).join('\n\n');
