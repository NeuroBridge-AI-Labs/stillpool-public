// 4.9's "Good fit or not?": six invented situations, one at a time. The words are the lesson's own text (pack rows B2 to B8,
// M2 to M6, P1 to P4, N1, N2, I1 to I4, X1, X2, W1, W3); every reading is ours, none is a ruling. No person, company or
// place in a situation is real, and nothing here is scored, stored or sent. The evidence rows carry no link on purpose (pack CR4).
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Which choice fits this situation best?';
export const OPTIONS = ['AI fits', 'Check carefully', 'Ask a person', 'Do it yourself'];
export const INTRO = [
  'Here are six invented situations, one at a time. For each, pick the choice you think fits best.',
  'The four choices are our labels, not a rule from anyone else. The reading we show is ours. It is not a ruling.',
  'Asking a person is a good choice. It is never a failure.',
];
export const NOTES = [
  'The question was never "can it?". It was "what happens if it makes a mistake, and who do I need?"',
  'Another lesson on this site, Harm and misuse, covers chatbots made to act like friends.',
  'These are six situations. They do not cover every case. Your pick may differ from ours for good reasons.',
];

const reading = (choice: string, why: string, ...rest: Row[]): Row[] => [
  { label: 'Our reading', text: choice },
  { label: 'Why', text: why },
  ...rest,
];
const anyway = (text: string): Row => ({ label: 'If you use it anyway', text });
const evidence = (text: string): Row => ({ label: 'The evidence', text });

export const CASES: Case[] = [
  {
    heading: 'Learning to write a cover letter',
    scene: 'Aoife wants a job in a shop. She has never written a cover letter. She will need one for every job she applies for, so she wants to get good at writing them herself.',
    answer: reading(
      'Do it yourself',
      'Her aim is the skill, and practice is how she builds it. In one school study, students who practised maths with a chatbot that gave answers scored lower on a test without it.',
      anyway('Write a first draft yourself. Then ask for hints or questions about your draft, not a finished letter. In the same study, a chatbot built to give hints largely removed the drop.'),
      evidence('A journal paper, published 25 June 2025: nearly 1,000 students in one high school in Turkey, in the 2023-2024 school year, using a GPT-4 chatbot. It was a maths study. It did not test writing. The students did not notice they had learned less.'),
    ),
  },
  {
    heading: 'A question about two medicines',
    scene: 'Sam bought antihistamine tablets for hay fever. Sam also takes a medicine from a doctor. Sam wants to know if the two are safe together, and asks a chatbot.',
    answer: reading(
      'Ask a person',
      'A mistake here could harm Sam. The World Health Organization says AI can produce false or incomplete statements that could harm people who use them to make health decisions. The HSE page on antihistamines says to ask a pharmacist if you take other medicines.',
      anyway('Treat the chatbot\'s answer as a question to take to a pharmacist. Read the leaflet that comes with the medicine, as the HSE page says. For signs of a serious allergic reaction, the HSE page says to call 112 or 999, or go to an emergency department.'),
      evidence('A 2026 study in Nature Medicine gave 1,298 UK adults written health scenarios from a set of ten. Some used a chatbot and some used their usual sources. People who used a chatbot scored no higher than people who used their usual sources at naming the condition and choosing the care. It tested 2024 chatbots. It was not about mixing medicines.'),
    ),
  },
  {
    heading: 'A friend going through a hard time',
    scene: 'Your friend tells you, in private, that they are struggling. You do not know what to say. You think about typing their story into a chatbot to get some words.',
    answer: reading(
      'Ask a person',
      'It is your friend\'s private story. Our rule is never to paste other people\'s information into an AI tool. Your friend trusted you, so you can ask them what they need, or ask another person you trust how to help. Another lesson on this site, Privacy habits, covers this.',
      anyway('Use invented details, not your friend\'s name or story. Then check the words with your friend, who knows what they need.'),
      { label: 'A person to call', text: 'Samaritans say they answer on 116 123, free, day or night, every day of the year (their Ireland page, read on 9 October 2026).' },
      evidence('The US Federal Trade Commission said on 11 September 2025 that chatbots "can effectively mimic human characteristics, emotions, and intentions". It said this may lead some users, especially children and teens, to trust them and form relationships with them.'),
    ),
  },
  {
    heading: 'News from yesterday',
    scene: 'A storm hit your area yesterday. You want to know which roads are closed and when the power will be back. You ask a chatbot.',
    answer: reading(
      'Check carefully',
      'Roads and power change fast, so an answer can be out of date. A study of AI answers to news questions counts out-of-date information as one kind of problem.',
      anyway('Check each fact on the page of the council or the power company, or call them. Look for the time the page was last updated.'),
      evidence('In June and July 2025, journalists at 22 media organisations in 18 countries checked more than 3,000 answers from four chatbots to news questions. They found a significant issue, one that could materially mislead the user, in nearly half of the answers. The study did not compare new events with old ones. We found no study that explains why.'),
    ),
  },
  {
    heading: 'The history of a Leitrim placename',
    scene: 'You want to write about the old Irish name of a townland in County Leitrim. A townland is a small traditional division of land in Ireland. Leitrim is an Irish county. You want to know what it means and where it comes from. You ask a chatbot, and it answers in English and in Irish.',
    answer: reading(
      'Check carefully',
      'Chatbots scored lower on Irish than on English in a 2025 test. A fact that few documents mention is also harder: a 2022 study found an AI answered a fact question better when more documents about that fact were in the text it learned from.',
      anyway('Look the name up in the Placenames Database of Ireland at logainm.ie, and compare. Its About page calls it "a comprehensive management system for the placenames data, records and research of the State".'),
      evidence('IRLBench is a paper whose numbers here come from its May 2025 version on arXiv, a site where researchers share papers. It gave AI models the 2024 Leaving Certificate exam questions in English and in Irish. The best model scored about 3 in 4 in English and a little over half in Irish. The marker was another AI model. That version is a preprint, which a journal has not reviewed. The work was later published in the proceedings of the KDD 2026 conference.'),
    ),
  },
  {
    heading: 'A packing list',
    scene: 'You are going away for a weekend in a hostel. You want a packing list so that you do not forget anything. You know what you own, and you will pack the bag yourself. The list is only for clothes and everyday items. Medicines, tickets and other essentials are on a checklist you already keep.',
    answer: reading(
      'AI fits',
      'Nothing serious depends on a list of clothes and everyday items. You will notice most gaps as you pack, and a missing sock costs little.',
      { label: 'What to check', text: 'Read the list against the weather forecast and your plans. Cross out what you do not need. Check medicines, tickets and other essentials against your own checklist, not the list the AI made.' },
    ),
  },
];
