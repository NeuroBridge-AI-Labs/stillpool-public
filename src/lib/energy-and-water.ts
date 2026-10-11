// 3.4's "Energy and water": six comparisons of a task with an everyday thing, each as the sourced range in words, with
// its source, its date and what it counts (pack rows E1 to E6, F5 to F30). The numbers of one text answer are the three
// sourced figures, never one number for "AI". The "about N to M answers" ranges are our arithmetic, labelled as ours, and
// energy-and-water.test.ts divides the sourced numbers to check them. Nothing here is scored.
import type { Case, Row } from './cases.ts';

// Watt-hours for one ordinary text answer: Google's measured median (May 2025) and the OpenAI chief executive's average.
export const ANSWER_WH = { google: 0.24, epoch: 0.3, openai: 0.34 };
// What each everyday thing uses, and the range of answers we say that equals (our arithmetic).
export const ARITHMETIC = {
  lamp: { wh: 8.5, said: [25, 35] },
  kettle: { wh: 60, said: [175, 250] },
  streaming: { wh: 188, said: [550, 780] },
} as const;
export const WATER = { bottleMl: 500, googleMl: 0.26, mistralMl: 45, bottleOfGoogle: 1900, bottleOfMistral: 11 };
export const TRAINING = { bloomKwh: 433196, homeKwh: 10500, homeYears: 41 };

export const QUESTION = 'Does the first use less, about the same, or more than the second?';
export const OPTIONS = ['Less', 'About the same', 'More', "I can't tell"];
export const INTRO = [
  'Here are six comparisons. We made this toy for the lesson. It holds only the sourced figures on this page.',
  'For each one, pick how the first thing sits next to the second. Then you see the sourced range in words, with its source and its date.',
  'The sources do not agree on one number for one answer, so we never show one. Each range says what was counted.',
];
export const NOTES = [
  "A model's final training run is one cost, and earlier tests and the wider work around it add more. Every answer after it is a separate, smaller cost. The sources give each in its own units and boundary, so we never add one to the other.",
  'The "about N to M answers" ranges are our arithmetic from the sourced numbers. They are not from the sources.',
];

const [a, b] = [ANSWER_WH.google, ANSWER_WH.openai];
const FIGURES = `Google measured ${a} watt-hours for its median Gemini Apps text prompt in May 2025 (Google, 21 August 2025). Epoch AI estimated roughly ${ANSWER_WH.epoch} watt-hours for a typical ChatGPT query (Epoch AI, 7 February 2025). OpenAI's chief executive said the average query uses about ${b} watt-hours (blog post, 10 June 2025, with no method given).`;
const COUNTED = "Google counts the whole serving system for its prompt, not only the chips. Epoch's number is an estimate from public facts, not a measurement of OpenAI's systems.";
const row = (label: string, text: string): Row => ({ label, text });
const range = (thing: string, key: keyof typeof ARITHMETIC) =>
  row('The range', `${thing} uses as much as about ${ARITHMETIC[key].said[0]} to ${ARITHMETIC[key].said[1]} answers. Our arithmetic: ${ARITHMETIC[key].wh} watt-hours divided by ${a} to ${b} watt-hours.`);

export const CASES: Case[] = [
  {
    heading: 'Comparison 1',
    scene: 'One ordinary text answer from an AI chatbot, next to an LED lamp left on for one hour.',
    answer: [
      row('Answer', 'Less.'),
      range('The lamp for one hour', 'lamp'),
      row('The figures for one answer', FIGURES),
      row('The lamp', `The Carbon Trust (2021) gives ${ARITHMETIC.lamp.wh} watt-hours for an LED lamp on for one hour.`),
      row('What is counted', COUNTED),
    ],
  },
  {
    heading: 'Comparison 2',
    scene: 'One ordinary text answer from an AI chatbot, next to a two-minute boil of an electric kettle.',
    answer: [
      row('Answer', 'Less.'),
      range('A two-minute kettle boil', 'kettle'),
      row('The figures for one answer', FIGURES),
      row('The kettle', `The Carbon Trust (2021) gives ${ARITHMETIC.kettle.wh} watt-hours for a two-minute boil at 1,800 watts. The kettle row is the Carbon Trust's own assumption from a 2021 source.`),
      row('What is counted', COUNTED),
    ],
  },
  {
    scene: 'One text answer where a long article is sent along with the question, next to one ordinary text answer.',
    heading: 'Comparison 3',
    answer: [
      row('Answer', 'More.'),
      row('The range', 'One estimate: about 2.5 watt-hours for an input of 10,000 tokens, which is a short paper or a long magazine article. That is about ten times an ordinary answer.'),
      row('The source', 'Epoch AI, 7 February 2025, for GPT-4o on its stated assumptions. Only Epoch gives this figure.'),
      row('What is counted', 'An estimate from public facts, not a measurement. Epoch also says queries with long outputs, such as reasoning models, may use substantially more.'),
    ],
  },
  {
    heading: 'Comparison 4',
    scene: 'One ordinary text answer from an AI chatbot, next to one hour of video streaming in Europe in 2020.',
    answer: [
      row('Answer', 'Less.'),
      range('One hour of video streaming', 'streaming'),
      row('The figures for one answer', FIGURES),
      row('Streaming', `The Carbon Trust (2021) gives ${ARITHMETIC.streaming.wh} watt-hours for an hour of video streaming in Europe in 2020, by its conventional approach. It says its figures are not designed to be used as representative figures for any given scenario.`),
      row('What is counted', 'The viewing device and its peripherals take just over half of that, and the home router over a third. This boundary is much wider than a count of the servers alone.'),
    ],
  },
  {
    heading: 'Comparison 5',
    scene: 'The water for one ordinary text answer, next to a 500 millilitre bottle of water.',
    answer: [
      row('Answer', 'Less, in every source we read. The sources are far apart.'),
      row('The range', `A bottle holds about ${WATER.bottleOfGoogle.toLocaleString('en-IE')} of Google's Gemini Apps text prompts at Google's estimated water use per prompt (${WATER.googleMl} millilitres each, May 2025), about ${WATER.bottleOfMistral} of Mistral Large 2's 400-token responses in Le Chat (${WATER.mistralMl} millilitres each, July 2025), and roughly 10 to 50 medium-length GPT-3 responses in one study (Li and others, version of 26 March 2025). The spread is more than 100 times. Our arithmetic.`),
      row('What is counted', "Google counts the water consumed for cooling machines and associated infrastructure in data centres. Mistral's figure is from its own lifecycle study, excludes users' devices, and counts upstream impacts for one answer under that method. Li and others modelled GPT-3, a model from 2020, in a study whose current version is dated 26 March 2025. They counted water on site and water used to make the electricity, and say the figure depends on when and where the model runs."),
      row('For scale', 'Uisce Éireann says the average person in Ireland uses about 133 litres of water a day (checked 3 October 2026).'),
    ],
  },
  {
    heading: 'Comparison 6',
    scene: 'Training one AI model, BLOOM, in 2022, next to the electricity one US home uses in a year.',
    answer: [
      row('Answer', 'More.'),
      row('The range', `BLOOM's training used ${TRAINING.bloomKwh.toLocaleString('en-IE')} kilowatt-hours on its chips. A US home uses about ${TRAINING.homeKwh.toLocaleString('en-IE')} kilowatt-hours a year. That is about ${TRAINING.homeYears} US home-years. Our arithmetic.`),
      row('The sources', 'Luccioni and others (2022) for BLOOM. Epoch AI (2025) for the US home, which is a US figure.'),
      row('What is counted', 'The chips only. Across the four models the paper compiled, training energy ran from 324 to 1,287 megawatt-hours, and the paper says an exact comparison is difficult. The paper also reports about 1.16 million kilowatt-hours for all the experiments of the wider BigScience workshop, so the final run is only part of the work.'),
    ],
  },
];
