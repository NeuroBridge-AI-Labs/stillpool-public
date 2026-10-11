// 5.7's "Local or cloud?": five invented tasks, one at a time. The words are the lesson's own Simple text (pack rows
// P4 to P6, P21 to P24, P26, P27); a company's page is that company's claim and says so, with the day we read it
// (9 October 2026). The tasks are invented. No row gives a speed or an energy figure, because the pack has none that
// fits a reader's own machine (pack CR2); a row with no source states no figure. Nothing here is scored.
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Which fits this task: your own machine, a cloud service, or either?';
export const OPTIONS = ['Your own machine', 'A cloud service', 'Either, if...'];
export const INTRO = [
  'Here are five invented tasks, one at a time. For each, predict which fits.',
  'Each answer has four rows: privacy, speed, quality and our call. All four rows show every time, even when one row decides it.',
  'Company pages are the companies’ own claims. We read them on 9 October 2026.',
];
export const NOTES = [
  'Where the words go decides privacy. How much memory your machine has limits which models it can run.',
  'The tasks are invented. Our call is our reading of the rows, not the only fair one.',
];

const LOCAL = 'LM Studio and Ollama each say they do not receive the words you send when you run models locally. These are company claims.';
const CLOUD = 'A cloud service answers on a company’s computers, so your words are sent there. Ollama says it processes what you send to its cloud models to give the service, and does not store or log it.';
const FAST = 'Ollama says its cloud models run on “fast, datacenter-grade hardware”. That is a company claim from 19 September 2025.';
const MACHINE = 'On your own machine, speed can depend on the machine. A 2024 post says one laptop “throttles quickly” when pushed hard.';
const BIGGER = 'Ollama says its cloud service lets you run larger models “that wouldn’t fit on a personal computer”. That is a company claim.';
const FIT = 'The llama.cpp page says a model is loaded fully into memory, so it has to fit. It says compressing a model may cost some accuracy.';

const trade = (privacy: string, speed: string, quality: string, call: string, ...rest: Row[]): Row[] => [
  { label: 'Privacy', text: privacy },
  { label: 'Speed', text: speed },
  { label: 'Quality', text: quality },
  { label: 'Our call', text: call },
  ...rest,
];

export const CASES: Case[] = [
  {
    heading: 'Summarise your own therapy notes',
    scene: 'You typed notes after your own therapy sessions. You want a short summary of the main themes. The notes name you and your health. This task is invented.',
    answer: trade(
      `Where the words go decides this one. ${LOCAL} ${CLOUD}`,
      `A short summary is a small job. We found no source that gives a speed for it. ${MACHINE}`,
      `${FIT} Check any summary against your own notes.`,
      'Your own machine, if you use a model for this at all. Use a local model and leave cloud features off. Then both companies say they do not receive your words. We did not watch either program\'s traffic. Lesson 4.4, Privacy habits, covers what to share with any AI.',
    ),
  },
  {
    heading: 'Translate a public press release',
    scene: 'A company has put out a press release in French on its public website. You want an English version to read. This task is invented.',
    answer: trade(
      `In this invented task the text is already public. The words still go somewhere. ${LOCAL} ${CLOUD}`,
      `A short text is a small job. ${FAST} ${MACHINE}`,
      'We found no source that rates translation quality for open models or for cloud services, so we make no claim about it.',
      'Either. Privacy does not decide this one, because the text is public. Use whichever you can run and read the result yourself.',
    ),
  },
  {
    heading: 'Draft code for a hobby project on an old laptop',
    scene: 'You are writing a small game in your free time. You want help drafting some code. Your laptop is old and has little memory. This task is invented.',
    answer: trade(
      `Nothing private is in this invented task. ${LOCAL} ${CLOUD}`,
      `${FAST} ${MACHINE}`,
      `${FIT} ${BIGGER}`,
      'Either, if your laptop has enough memory for a compressed model. If it does not, a cloud service is the option the sources describe for larger models. Memory decides this one.',
      {
        label: 'The figures',
        text: 'For the model Llama 3.1 8B, the llama.cpp page lists 32.1 GB for the original file and 4.9 GB after compression to Q4_K_M. These are file sizes, so the page names no machine. Last changed 5 June 2026, read 9 October 2026.',
        href: 'https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md',
      },
    ),
  },
  {
    heading: 'Work through a hard problem step by step',
    scene: 'You are stuck on a hard problem with many steps, for a course you are taking. You want a worked solution to study. You will check each step yourself. This task is invented.',
    answer: trade(
      `Nothing private is in this invented task. ${CLOUD}`,
      `${FAST} ${MACHINE}`,
      `${BIGGER} Epoch AI found that, since January 2026, the best open models trailed leading closed models by about four months on its combined score. That compares the best open model each day, not a model small enough for a laptop. We found no source that rates models on this task.`,
      'Either. Try the models you can use on your own problem, and check each step yourself. Memory limits which models your machine can run.',
      {
        label: 'The figures',
        text: 'Epoch AI, 29 May 2026: an average gap of four months, from 1 January to 28 May 2026, on its own combined score. It is not a test of your task.',
        href: 'https://epoch.ai/data-insights/open-closed-eci-gap',
      },
    ),
  },
  {
    heading: 'Fix the grammar in an email on a train',
    scene: 'You are on a long train journey with no internet. You wrote a short email and want its grammar checked. This task is invented.',
    answer: trade(
      `${LOCAL} A cloud service has to send your words away, and that needs a connection.`,
      `A short email is a small job. We found no source that gives a speed for it. ${MACHINE}`,
      `The model must already be on your machine. LM Studio’s policy says that searching for and downloading a model uses the internet. ${FIT}`,
      'Your own machine, if you downloaded a model before the journey. LM Studio says it can run entirely on your device.',
    ),
  },
];
