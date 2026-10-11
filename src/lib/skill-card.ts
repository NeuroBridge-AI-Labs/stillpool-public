// 2.7's skill card (stage I): four fields, each a strong or a weak wording. Four strong picks make the card we ran, word
// for word; the strong wordings are the recording's own. Any weak pick makes a card we did not run, and the activity says so.
// The weak wordings are written for this activity and were never sent to a model.
export const FIELDS = [
  { name: 'Purpose', strong: 'turn a transcript into notes a busy team can read in one minute', weak: 'help with meetings' },
  { name: 'Steps', strong: '1. List decisions. 2. List actions, each with an owner and a date. 3. List open questions.', weak: 'Read it and write down what matters.' },
  { name: 'Rules', strong: "never invent a name or a date; if something is unclear, write 'unclear'", weak: 'Be accurate and do a good job' },
  { name: 'Format', strong: 'three headed lists, nothing else', weak: 'Make it look nice' },
] as const;
export type Pick = 'strong' | 'weak';

export const isPick = (v: unknown): v is Pick => v === 'strong' || v === 'weak';
// The card as it would be sent. Purpose, Rules and Format end in a full stop that the card adds; Steps carries its own.
export function cardText(picks: Pick[]): string {
  if (picks.length !== FIELDS.length || !picks.every(isPick)) throw new Error('a card needs one strong or weak pick for each field');
  const [purpose, steps, rules, format] = FIELDS.map((f, i) => f[picks[i]]);
  return `Procedure: meeting notes. Purpose: ${purpose}. Steps: ${steps} Rules: ${rules}. Format: ${format}.`;
}
// Only four strong picks make a card that was run.
export const wasRun = (picks: Pick[]) => picks.length === FIELDS.length && picks.every((p) => p === 'strong');
