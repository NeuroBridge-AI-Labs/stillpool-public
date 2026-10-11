// 3.8's "What's at stake?": five invented cases and a last pick of the seven requirements, as the EU's expert group (the
// HLEG) prints them. Every reading is ours, built from the HLEG's own words (pack rows I3 to I8, F8, F9); none is a ruling.
// No company, product, person or place is real, and nothing here is scored, stored or sent.
import type { Case } from './cases.ts';

export const REQUIREMENTS = [
  'Human agency and oversight',
  'Technical robustness and safety',
  'Privacy and data governance',
  'Transparency',
  'Diversity, non-discrimination and fairness',
  'Societal and environmental well-being',
  'Accountability',
];
export const QUESTION = 'Which requirement is most at stake in this case?';
export const INTRO = [
  'We made up five short cases. Nothing in them is real: no company and no person.',
  'For each case, pick the requirement you think is most at stake. The seven are the ones in the guidelines from the EU\'s expert group, the HLEG.',
  'The HLEG says "all requirements are of equal importance". So a case can have more than one good answer. The reading we show is ours, built from the HLEG\'s words. It is not a ruling.',
];

const reading = (stake: string, why: string): Case['answer'] => [
  { label: 'Our reading', text: stake },
  { label: 'Why', text: why },
];
const change = (choice: string, moves: string, why: string, ...more: string[]): Case['change'] => ({
  choice,
  moves: [{ label: 'It moves', text: moves }, { label: 'Why', text: why }, ...more.map((text) => ({ label: 'Note', text }))],
});

export const CASES: Case[] = [
  {
    scene: 'A school app uses AI to mark each essay. The mark goes straight into the report. No teacher reads the essay.',
    answer: reading('Human agency and oversight', 'No person checks the mark before it goes in the report. The HLEG says oversight "helps ensuring that an AI system does not undermine human autonomy or causes other adverse effects."'),
    change: change(
      'A teacher reads each mark before it goes in the report, and can change it.',
      'Human agency and oversight',
      'The HLEG describes "the capability for human intervention in every decision cycle of the system". It says oversight can "ensure the ability to override a decision made by a system".',
      'The HLEG also says that intervention in every decision cycle "in many cases is neither possible nor desirable". A check on every decision may not suit every system.',
    ),
  },
  {
    scene: "A shop's chat helper has a human name and a photo. It never says it is an AI.",
    answer: reading('Transparency', '"AI systems should not represent themselves as humans to users; humans have the right to be informed that they are interacting with an AI system."'),
    change: change(
      'The helper is labelled as an AI, and there is a button to reach a person.',
      'Transparency',
      'The HLEG says AI systems "must be identifiable as such". It says the option to choose human interaction "should be provided where needed".',
    ),
  },
  {
    scene: "A firm uses AI to rank job applicants. It learned from the firm's past hires. Nobody has checked the results for different groups.",
    answer: reading('Diversity, non-discrimination and fairness', 'The HLEG says data sets "may suffer from the inclusion of inadvertent historic bias". It says the continuation of such biases "could lead to unintended (in)direct prejudice and discrimination against certain groups or people".'),
    change: change(
      'Applicants can ask a named person to look at their case again.',
      'Accountability, and it may also support procedural fairness',
      'The HLEG says "accessible mechanisms should be foreseen that ensure adequate redress."',
      'This gives people a way to put things right. An appeal alone does not remove the bias in how applicants are ranked. One design choice can move a different requirement from the one you were looking at.',
    ),
  },
  {
    scene: 'An app for young readers saves every question a child types. All staff can open every saved question.',
    answer: reading('Privacy and data governance', 'The HLEG says AI systems "must guarantee privacy and data protection throughout a system’s entire lifecycle". It includes "the information generated about the user over the course of their interaction".'),
    change: change(
      'Only named, qualified staff who need the data, with a reason, can open the saved questions.',
      'Privacy and data governance',
      '"Only duly qualified personnel with the competence and need to access individual\'s data should be allowed to do so."',
    ),
  },
  {
    scene: 'A town library buys an AI to sort returned books. Nobody has asked how much electricity it uses to run.',
    answer: reading('Societal and environmental well-being', 'The HLEG says the "development, deployment and use process, as well as its entire supply chain, should be assessed" for this.'),
    change: change(
      'The library asks the maker how much energy the system uses, and compares it with other ways to do the job.',
      'Societal and environmental well-being',
      'The HLEG names "a critical examination of the resource usage and energy consumption during training, opting for less harmful choices".',
      'This case says nothing about how much energy any real AI uses.',
    ),
  },
  {
    heading: 'Last pick',
    scene: 'Last, pick the requirement that matters most to you. Your pick is never scored, stored or sent anywhere.',
    question: 'Which requirement matters most to you?',
    answer: [
      { label: 'What the HLEG says', text: 'It lists the seven "Without imposing a hierarchy", and says "all requirements are of equal importance".' },
      { label: 'What your pick shows', text: 'What you weigh first. It does not show what is right.' },
      { label: 'Not in any case', text: 'In our readings, technical robustness and safety is the main stake of none of the five cases. You can still choose it for any case, and for this pick.' },
    ],
  },
];
