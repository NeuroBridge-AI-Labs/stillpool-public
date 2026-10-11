// 4.7's "Split the task": one invented job in five steps, one step at a time. The job, the group and the steps are made up by us
// (pack row G2); the reasons use only the sources in pack rows M1 to M3, A1 and A2. The four choices are our labels (M6) and the
// split is a worked example, not a rule. Nothing here is scored, stored or sent.
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Who should do this step?';
export const OPTIONS = ['Do it yourself', 'Let AI help', 'Let AI do it, then check', "Don't use AI here"];
export const INTRO = [
  'We made up one job: writing the monthly newsletter for a volunteer group. Nothing in it is real, not the group and not the people.',
  'The job has five steps. For each step, pick who should do it. The four choices are our labels.',
  'The middle two follow the AI Fluency Framework. In its augmentation, a person and AI do a task together, in turns. In its automation, AI does a task from a person\'s direct instructions.',
  'Our split is a worked example, not a rule. Another group could split the same job another way.',
];
export const NOTES = [
  'Our whole split: collect the updates, let AI help. Write the first draft, let AI do it, then check. Check names and dates, do it yourself. Choose photos, do not use AI here. Send, do it yourself.',
  'Look at which steps a person keeps. The step with people\'s names and the step that sends are both kept by a person.',
  'Giving a step to AI does not give away who answers. In every step here, the editor answers.',
];

const split = (choice: string, why: string, ...rest: Row[]): Row[] => [
  { label: 'Our split', text: choice },
  { label: 'Why', text: why },
  { label: 'Who answers if it is wrong', text: 'The editor, the one volunteer who sends the newsletter. The framework says taking responsibility for the final product made with AI is part of its skill called Diligence.' },
  ...rest,
];

export const CASES: Case[] = [
  {
    heading: 'Collect the updates',
    scene: 'Members send their news by email. Some write a page, some write one line, and some forward a message from someone else. The editor needs one tidy list of what happened this month.',
    answer: split(
      'Let AI help',
      'The framework describes this way of working as a person and AI doing a task together, in turns. The emails come in many shapes, so the editor and the AI can sort them in turns. This is our advice: use only a tool your group has approved. Or swap real names and forwarded messages for invented ones before you put them into an AI tool.',
    ),
  },
  {
    heading: 'Write the first draft',
    scene: 'Every month the newsletter has the same parts: a welcome, the news list and the date of the next meeting. The wording changes very little from one month to the next.',
    answer: split(
      'Let AI do it, then check',
      'The framework says AI can do a task from direct instructions, and that this suits repetitive tasks. It also says this needs a clear task and quality checks. This step repeats each month, so the instructions can be clear. The editor then checks the draft.',
    ),
  },
  {
    heading: 'Check names and dates',
    scene: 'The draft names volunteers and gives the dates of meetings and a trip. The editor reads it before it goes anywhere.',
    answer: split(
      'Do it yourself',
      'The framework\'s skill called Diligence includes fact-checking and testing for accuracy before AI-assisted work is released. This step is that check, so the editor does it. Names are also other people\'s information. Another lesson on this site, Privacy habits, covers what is safe to type into an AI tool.',
    ),
  },
  {
    heading: 'Choose photos',
    scene: 'Photos from past events show the faces of members. The group has not agreed whether photos of its members may be put into an AI tool.',
    answer: split(
      "Don't use AI here",
      'The EU expert group says a person\'s control over an AI system can include "the decision not to use an AI system in a particular situation". Here the group has not agreed what may go into a tool, so this step stays out of AI. Another lesson on this site, Privacy habits, covers what is safe to put into one.',
    ),
  },
  {
    heading: 'Send it',
    scene: 'Sending puts the newsletter in the inbox of every member. After the send, the editor cannot change what each member received.',
    answer: split(
      'Do it yourself',
      'The framework says part of Diligence is verifying and vouching for AI-assisted work, with safety checks and tests before it is released. Sending is the release, so the person who vouches for the newsletter sends it.',
      {
        label: 'The framework (a link)',
        text: 'The AI Fluency Framework website. In our test on 9 October 2026, it loaded files from seven other hosts. They were www.youtube.com, i.ytimg.com, fonts.gstatic.com, www.google.com, jnn-pa.googleapis.com, googleads.g.doubleclick.net and static.doubleclick.net. Five cookies, all from .youtube.com, were set before any choice.',
        href: 'https://aifluencyframework.org/',
      },
    ),
  },
];
