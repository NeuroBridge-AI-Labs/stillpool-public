// 4.2's "Help or hand-in?": eight study uses, one at a time. The words are the lesson's own Simple text (pack rows H1 to H20).
// Every reading is ours, built from the words of NAIN, QQI, the HEA and UCL; none is a ruling, and each case's brief and
// StudyBot are made up (pack CR3). Nothing here is scored, stored or sent.
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Is this study use fine, fine if you declare it, not allowed, or does it depend on your course rules?';
export const OPTIONS = ['Fine', 'Fine if you declare it', 'Not allowed', 'Depends on your course rules'];
export const INTRO = [
  'Here are eight study uses, one at a time. For each, predict one of four answers.',
  'Some details are made up, such as StudyBot and what each brief says. We chose them to make each case clear. They are not real rules.',
  'Our readings use the words of NAIN, QQI and the HEA, which the lesson names. They are our readings, not rulings. Your own course decides.',
];
export const NOTES = [
  "Your course's rules win over this list. Look in your assignment brief first, then at your college's policy on AI. If it is still unclear, ask your lecturer.",
  'Look at the pattern. The same tool can be fine for one task and not for another. What changes is what the task is meant to show, and whether anything the AI made ends up in what you hand in.',
];

const reading = (answer: string, why: string, ...rest: Row[]): Row[] => [
  { label: 'Our reading', text: answer },
  { label: 'Why', text: why },
  ...rest,
];
const write = (text: string): Row => ({ label: 'What to write', text, quote: true });

export const CASES: Case[] = [
  {
    heading: 'Explain a lecture slide',
    scene: 'Your course allows AI tools for private study help. You did not follow one slide from a lecture. You ask an AI tool to explain it in plain words. You read the answer and check it against your own notes. You do not hand in what the tool wrote.',
    answer: reading(
      'Fine',
      "NAIN's case of a breach is about work that students hand in. Here, nothing the AI made goes into your work. NAIN also says AI tools can give unreliable answers while seeming confident, so check the explanation.",
    ),
  },
  {
    heading: 'Practice questions',
    scene: 'Your course allows AI tools for private study help. You ask an AI tool for ten practice questions on a topic from your course. You answer them on paper. Then you check your answers against your textbook. Nothing from the tool goes into any work you hand in.',
    answer: reading(
      'Fine',
      'QQI says AI "should support rather than replace learning". Practice questions do that, and nothing the AI made is handed in. Check its questions and your answers against your textbook.',
    ),
  },
  {
    heading: 'Paste the brief, hand in the essay',
    scene: 'The brief for your essay says the essay must be your own work and that AI tools are not permitted for it. You paste the brief into an AI tool. You hand in the essay it writes, with no note.',
    answer: reading(
      'Not allowed',
      'NAIN says integrity "is breached" if students hand in the products of GenAI "as their own work without acknowledgement or without authorisation". Here the brief gives no permission and you give no acknowledgement. QQI also lists "unauthorised use of artificial intelligence including generative artificial intelligence (GenAI)" as misconduct.',
    ),
  },
  {
    heading: 'Ideas for headings',
    scene: 'The brief says you may use AI to plan, if you say so in your work. You ask StudyBot 3 for ideas for headings for your essay. You pick two, change them, and write the whole essay yourself. You check both against the brief.',
    answer: reading(
      'Fine if you declare it',
      'In this made-up course, the brief allows planning help and asks for a note. The HEA says that where disclosure is required, students should comply fully and accurately. Here is a log entry for it.',
      write('9 October. StudyBot 3. I asked for heading ideas for my essay. I used two and changed them. I checked them against the brief.'),
    ),
  },
  {
    heading: 'Feedback on a draft',
    scene: 'The brief says you may use AI to get feedback on a draft, if you add a declaration. You ask StudyBot 3 which parts of your draft are unclear. You rewrite two paragraphs yourself and check your changes against your sources. The tool writes none of the final text.',
    answer: reading(
      'Fine if you declare it',
      'In this made-up course, the brief allows feedback and asks for a declaration. The HEA says a declaration names the tool, the purpose, how much the tool contributed and the steps you took to check.',
      write('I used StudyBot 3 on 9 October to give feedback on my draft. I rewrote two paragraphs myself. I checked my changes against my sources.'),
    ),
  },
  {
    heading: 'Proofread a finished essay',
    scene: 'You write an essay yourself. Before you hand it in, you ask an AI tool to fix the spelling and grammar. Your brief does not say whether that is allowed.',
    answer: reading(
      'Depends on your course rules',
      'The HEA lists "language editing" (fixing wording, spelling or grammar) among the uses a declaration describes. UCL\'s example acknowledgement includes "proofread my final draft". The HEA says a college policy sets which uses are permitted, conditional or banned. So whether yours allows it, or wants a note, is your course\'s decision. The HEA says to ask when the brief is unclear.',
    ),
  },
  {
    heading: 'Code for a coding task',
    scene: 'A coding assignment asks you to write a function. You ask an AI tool to write the function for you. The brief does not say if AI is allowed. You are unsure what the assignment is meant to show.',
    answer: reading(
      'Depends on your course rules',
      'NAIN says assessment gives you a chance to show you reached the learning goals, and that credit is for your work. If the task is meant to show you can write the function, AI writing it can hide that. Ask your lecturer what the task is for.',
    ),
  },
  {
    heading: 'References from a chatbot',
    scene: 'You ask an AI tool for five references for your essay. They look real. You add them to your reference list without opening any of them.',
    answer: reading(
      'Not allowed',
      'UCL says AI "may fabricate quotations and citations". QQI says "It is the responsibility of the learner to ensure that all material submitted is genuine." So open each source and read it before you list it. Lesson 4.1, Check it before you use it, shows how.',
    ),
  },
];
