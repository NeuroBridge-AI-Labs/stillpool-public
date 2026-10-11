// 4.4's "Read the small print": three questions about one invented terms text for a made-up tool, Lumen, printed in the lesson as six clauses. The terms are
// ours (pack rows X1 to X4); no company, product or person in them is real. The "What to do" rows are the lesson's own advice
// (pack rows H1 to H7). Nothing here is scored, stored or sent.
import type { Case } from './cases.ts';

export const QUESTION = 'Does the small print say yes, no, or nothing about this?';
export const OPTIONS = ['Yes', 'No', 'It does not say'];
export const INTRO = [
  'We made up this small print. Lumen is not a real tool, and nothing in it is a real company\'s words.',
  'Read the six clauses above once. Then answer three questions about it, one at a time. For each, pick Yes, No, or It does not say.',
  'Real small print is longer, and it changes.',
];
export const NOTES = [
  'The answer to question 1 was in clause 4, under a heading that did not say "training".',
  '"It does not say" is an answer. Write it down as not found, and then look at the tool\'s settings or ask the person who runs the tool.',
];

export const CASES: Case[] = [
  {
    heading: 'Question 1',
    question: 'Does Lumen train on what you type?',
    scene: 'Read clauses 3 and 4 above.',
    answer: [
      { label: 'The clause', text: 'Clause 4, making Lumen better: "we may use the messages you send to train Lumen."', quote: true },
      { label: 'In plain words', text: 'Yes. Lumen may use your messages to train it. Real company pages word this as using chats to improve their AI models. The heading did not say "training", so you have to read the clause.' },
      { label: 'What to do about it', text: 'Type only what you would be fine with Lumen using this way. Use invented details in place of real names and places.' },
    ],
  },
  {
    heading: 'Question 2',
    question: 'Does the small print say you can turn that off?',
    scene: 'Read all six clauses above.',
    answer: [
      { label: 'The clause', text: 'None. No clause mentions a setting, a switch or a way to say you do not want this.' },
      { label: 'In plain words', text: 'It does not say. The small print is silent. That is not the same as No, and it is not the same as Yes.' },
      { label: 'What to do about it', text: 'Write it down as not found. Then look for a settings page, or ask the person who runs the tool. Until you know, assume your messages may be used.' },
    ],
  },
  {
    heading: 'Question 3',
    question: 'Does the small print say how long Lumen keeps your messages?',
    scene: 'Read clauses 5 and 6 above.',
    answer: [
      { label: 'The clause', text: 'Clause 5, keeping messages: "when you delete a chat, we remove it from our servers after 90 days."', quote: true },
      { label: 'In plain words', text: 'Yes, in part. After you delete a chat, Lumen keeps it for 90 days. The clause says nothing about how long a chat is kept if you never delete it.' },
      { label: 'What to do about it', text: 'Deleting a chat does not remove it at once. Do not type anything you could not live with Lumen holding for that time.' },
    ],
  },
];
