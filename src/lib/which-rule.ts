// 2.3's ordering part (stage I): four invented rules for a study-helper chatbot, one per tier of lesson 2.3, put in
// order by clicking. RULES is the lesson's own order, the hardest to change first. Nothing here scores an order.
export const RULES = [
  { rule: 'Never write anything that could harm a student.', reason: 'Tier 1. No message may change it.' },
  { rule: "Never write the student's text for them.", reason: 'Tier 2. Only the tool\'s owner may change it.' },
  { rule: 'Keep answers short, unless the question needs more.', reason: 'Tier 3. It is a default, and context may change it.' },
  { rule: 'Call me by this nickname.', reason: 'Tier 4. The user may change it.' },
] as const;
// The order shown first: no rule starts in its own place.
export const START = [2, 0, 3, 1];
export const ORDINAL = ['first', 'second', 'third', 'fourth'];

// One rule one place up (by -1) or down (by 1), as a new order; at an end the order comes back unchanged.
export function move(order: number[], at: number, by: -1 | 1): number[] {
  const to = at + by;
  if (to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

// Each rule in the lesson's order, with its reason and where the reader put it, in words.
export const check = (order: number[]) =>
  RULES.map((r, right) => {
    const put = order.indexOf(right);
    return { ...r, yours: put === right ? 'You put it here.' : `You put it ${ORDINAL[put]}.` };
  });
