// A meeting transcript as speaker turns (2.7's skill card builder). Every line is "Name (role): words" or "Name: words";
// the role is given once and kept for the speaker's later lines. Words and order stay exactly as recorded. A text that is
// not made of such lines (the e2e fixture's one-line stand-in) has no turns, and the page shows it as it is.
export type Turn = { name: string; role?: string; words: string; speaker: number };

const LINE = /^([A-Z][a-z]+)(?: \(([^)]+)\))?: (.+)$/;

export function turns(text: string): Turn[] {
  const order: string[] = [];
  const roles = new Map<string, string>();
  const out: Turn[] = [];
  for (const line of text.trim().split('\n')) {
    const m = LINE.exec(line);
    if (!m) return [];
    if (!order.includes(m[1])) order.push(m[1]);
    if (m[2]) roles.set(m[1], m[2]);
    out.push({ name: m[1], role: undefined, words: m[3], speaker: order.indexOf(m[1]) + 1 });
  }
  return out.map((t) => ({ ...t, role: roles.get(t.name) }));
}
