// 5.2's "Keep, fix or switch off?": an invented test report, and the call our made-up rule gives at each wrong-answer rate the
// reader might accept (pack rows A1 to A8, D1 to D4; the rule is ours, not a standard). Whole numbers only, no randomness, so the
// build and the tests agree. Over means wrong x k > questions, so exactly the rate accepted is not over. Never a percentage.
export type Group = { name: string; label: string; questions: number; wrong: number };
export type Report = { title: string; intro: string; groups: Group[]; serious: number; notTested: string };

export const REPORT: Report = {
  title: 'Test report: the college helpdesk chatbot (invented)',
  intro: 'This test report is invented. The chatbot, the college and every number are made up for this lesson. Staff checked every answer first.',
  groups: [
    { name: 'Group A', label: 'Students who write in English as a first language', questions: 100, wrong: 1 },
    { name: 'Group B', label: 'Students who write in English as a second language', questions: 100, wrong: 8 },
  ],
  serious: 0,
  notTested: 'Other kinds of question, and whether students could use the answers.',
};
export const TOLERANCES = [50, 20, 10, 5]; // "about 1 wrong in k"; the second is the default
export const DEFAULT_TOLERANCE = 20;
export const CALLS = { off: 'Switch off', fix: 'Fix, then test again', keep: 'Keep, and keep testing' } as const;
export const RULE = [
  'If all the questions together are over the rate you accept: switch off.',
  'If one group is over, and a serious answer was wrong: switch off.',
  'If one group is over, or a serious answer was wrong: fix it and test again.',
  'Otherwise: keep it, and keep testing.',
];
export const NOTICE = 'The numbers did not change. What you would accept did, and the call moved with it. This report cannot say how the chatbot does on other kinds of question, or if students could use the answers.';

export const totals = (r: Report) => ({ questions: r.groups.reduce((n, g) => n + g.questions, 0), wrong: r.groups.reduce((n, g) => n + g.wrong, 0) });
const over = (wrong: number, questions: number, k: number) => wrong * k > questions;
const against = (wrong: number, questions: number, k: number) => (over(wrong, questions, k) ? 'over' : wrong * k === questions ? 'exactly' : 'under');
// In words: "8 wrong in 100", and for the total "about 1 in 22".
const said = (wrong: number, questions: number) => `${wrong} wrong in ${questions}`;
const worst = (r: Report) => r.groups.reduce((a, g) => (g.wrong * a.questions > a.wrong * g.questions ? g : a));

// The report as lines of words, never a percentage.
export function reportLines(r: Report): string[] {
  const { questions, wrong } = totals(r);
  return [
    ...r.groups.map((g) => `${g.name}, ${g.label.replace(/^./, (c) => c.toLowerCase())}: ${said(g.wrong, g.questions)}.`),
    `All ${questions} questions: ${wrong} wrong, about 1 in ${Math.round(questions / wrong)}.`,
    `Serious wrong answers (a wrong deadline or fee): ${r.serious ? r.serious : 'none found'}.`,
    `Not tested: ${r.notTested.replace(/^./, (c) => c.toLowerCase())}`,
  ];
}

export function decide(r: Report, k: number): { call: string; reasons: string[] } {
  const { questions, wrong } = totals(r);
  const total = over(wrong, questions, k);
  const g = worst(r);
  const group = over(g.wrong, g.questions, k);
  const serious = r.serious > 0;
  const call = total || (group && serious) ? CALLS.off : group || serious ? CALLS.fix : CALLS.keep;
  const reasons = [
    `All ${questions} questions together had ${wrong} wrong, which is ${against(wrong, questions, k)} 1 wrong in ${k}.`,
    `${g.name} had ${said(g.wrong, g.questions)}, which is ${group && total ? 'also over' : against(g.wrong, g.questions, k)} 1 in ${k}${group && !total ? ', so one group does worse' : ''}.`,
  ];
  if (total) return { call, reasons };
  if (!serious) reasons.push(`No serious wrong answer was found${call === CALLS.fix ? ', so this is a fault to fix and test again, not a reason to switch off' : ''}.`);
  else reasons.push(`A serious wrong answer was found${call === CALLS.off ? ' as well, so switch off' : ', so fix it and test again'}.`);
  return { call, reasons };
}

// Where the call moves as the accepted rate goes from 1 in 50 to 1 in 5, and why, in words.
const SHORT: Record<string, string> = { [CALLS.off]: 'Switch off', [CALLS.fix]: 'Fix', [CALLS.keep]: 'Keep' };
export function flipLine(r: Report): string {
  const { questions, wrong } = totals(r);
  const g = worst(r);
  const why = (from: string, to: string, k: number) =>
    from === CALLS.off && to === CALLS.fix
      ? `${said(wrong, questions)} is under 1 in ${k} but ${said(g.wrong, g.questions)} is not`
      : to === CALLS.keep
        ? `${g.name.replace('Group', 'group')} is then under the rate`
        : 'the numbers cross the rate you accept';
  let moved = false;
  return TOLERANCES.slice(1)
    .map((k, i) => {
      const [before, [from, to]] = [TOLERANCES[i], [decide(r, TOLERANCES[i]).call, decide(r, k).call]];
      if (from === to) return `It does not move between 1 in ${before} and 1 in ${k}.`;
      const start = moved ? 'It moves' : 'The call moves';
      const about = moved ? '' : 'about ';
      moved = true;
      return `${start} from ${SHORT[from]} to ${SHORT[to]} between ${about}1 in ${before} and 1 in ${k}, because ${why(from, to, k)}.`;
    })
    .join(' ');
}
