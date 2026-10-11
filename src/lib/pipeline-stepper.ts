// 5.1's "Pipeline stepper" (stage I): one question through five stages, with the recorded base and tuned answers (R-5.1) at
// stages 1 and 4 only. The words are the lesson's writer's; the stepper itself is src/lib/steps.ts. R-5.1 is a local
// recording whose two variants carry no label or maker, and the file is never edited, so they are named here: the first is
// BASE (maker A), the second TUNED (maker B), the way Pillar 2 names its variants.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { recorded, recording } from '../lesson-schema.ts';
import { reading, variantOf, type Said } from './p2-runs.ts';
import type { Stage } from './steps.ts';

export const TITLE = 'Pipeline stepper';
export const NAME = 'pipeline';
export const STAGE_LIST = 'The five stages';
export const INTRO = [
  'One question goes through five stages. The question is "What is the capital of Ireland?"',
  'At each stage, pick how you think the answer will look. Then see what the stage changes.',
  'Only the first and the fourth stage have recorded answers. The stages in between were not recorded one by one.',
];
export const NOTES = [
  'A base model continues a text. Tuning makes it answer.',
  'This is one small model, one question and three runs of each version. It is not how a large chatbot looked before tuning.',
];

const LEGEND = 'What will the answer look like now?';
const OPTIONS = ['It continues the text as if it were a document', 'It answers the question', 'It answers and adds a safety or politeness line'];
const PREDICTED = ['continues the text as if it were a document', 'answers the question', 'answers and adds a safety or politeness line'];
const RECORDED = 'In the recording, the base version began with "Dublin" in all three runs, and none stopped by itself.';
const NONE = "No recording for this stage; what follows is the lesson's sourced description, not a model answer.";
const stage = (heading: string, scene: string[], answer: Stage['answer'], said?: string[]): Stage =>
  ({ heading, scene: [scene.join(' ')], questions: [{ legend: LEGEND, options: OPTIONS, said }], answer });

export const STAGES: Stage[] = [
  stage('Pretraining', ['The model is trained on a huge collection of text to predict the next word.', 'Anthropic\'s glossary says such a model is "not inherently good at answering questions or following instructions".'], [
    { label: 'What this stage changes', text: 'It teaches the model to predict the next word of a text. It does not teach it to answer.' },
    { label: 'What we can show', text: 'Three recorded runs of the base version of OLMo 2 1B, then the settings. The question was sent as raw text.' },
  ], PREDICTED.map((p) => `You predicted that it ${p}. ${RECORDED}`)),
  stage('Instruction tuning', ['The model is trained further on examples.', 'Each example is a request with a good answer.'], [
    { label: 'What this stage changes', text: 'The model sees requests paired with good answers. Fine-tuning is further training on more data, and the model then copies patterns in that data.' },
    { label: 'What we can show', text: `${NONE} Ai2 published a saved copy of OLMo 2 1B from after this step. We did not run it.` },
  ]),
  stage('Learning from preferences', ['People choose between two answers to the same request.', "In Meta's Llama 2 report, a reward model scores answers, and the scores are used as rewards to improve the chat version."], [
    { label: 'What this stage changes', text: 'People choose between answers, and a reward model learns to score answers like their choices. OpenAI\'s InstructGPT paper says its result "still makes simple mistakes".' },
    { label: 'What we can show', text: `${NONE} Ai2 published a saved copy of OLMo 2 1B from after its own preference step. We did not run it.` },
  ]),
  stage('Safety tuning', ['People write risky requests and safe answers.', "Meta's report also trained a separate safety reward model."], [
    { label: 'What this stage changes', text: "People write risky requests and safe answers, and choose the safer of two answers. Anthropic's Constitutional AI paper used a list of rules, and a model chose some of the answers." },
    { label: 'What we can show', text: 'Three recorded runs of the tuned version of OLMo 2 1B (Instruct). This is the finished chat version, after all of Ai2\'s tuning steps, so it shows what tuning does overall, not what safety tuning alone adds. Ai2\'s card says the model has "limited safety training".' },
  ]),
  stage('Updated later', ['A maker can release a new version and retire the old one.', 'It can also change the instructions it adds.'], [
    { label: 'What this stage changes', text: 'Makers release new versions, retire old ones and change the instructions they add. A changed answer alone does not tell you which of these caused it.' },
    { label: 'Companies update it', text: 'As safer and more capable models launch, Anthropic regularly retires older ones.', quote: true },
    { label: 'What we can show', text: `${NONE} Lesson 1.5, Where your question goes, covers cut-off dates.` },
  ]),
];

// The writer's marks (their handoff, section 3a), moved here because recorded.yaml may not name unlabelled variants
// (check:content), and shown by RunCard like any mark. A fixture's recorded.yaml can carry its own.
const stops = 'It does not stop by itself.';
const MARKS: NonNullable<Said['marks']> = [
  { variant: 'BASE', maker: 'A', run: 1, shows: true, note: `It names Dublin, then keeps writing facts about Ireland. ${stops}`, falseText: "it's not the capital of the Republic of Ireland", reason: 'Dublin City Council\'s plan says: "As the State’s capital, Dublin performs a significant economic, administrative and cultural role." We read "it" as Dublin.' },
  { variant: 'BASE', maker: 'A', run: 1, shows: true, note: 'It also compares the size of Ireland with a US state.', falseText: "It's about the size of the state of Washington", reason: 'The Geological Survey Ireland page gives Ireland as 70,000 km2. The US Census Bureau gives the land area of Washington as 66,455.5 square miles, about 172,000 km2. Washington is about two and a half times as large.' },
  { variant: 'BASE', maker: 'A', run: 1, shows: true, note: 'It also gives a number of people for Ireland.', falseText: 'with a population of about 4.5 million', reason: 'The Central Statistics Office gives Ireland "5.1 million people" in the 2022 census.' },
  { variant: 'BASE', maker: 'A', run: 2, shows: true, note: `It names Dublin, then asks new questions about rivers and cities. ${stops}` },
  { variant: 'BASE', maker: 'A', run: 2, shows: true, note: 'It also ranks Irish rivers by length.', falseText: 'The River Slaney is the second longest river in Ireland.', reason: 'Uisce Éireann\'s Regional Water Resources Plan for the South East says: "The Barrow River is the second-longest river in Ireland (after the Shannon River)". The Slaney is not second.' },
  { variant: 'BASE', maker: 'A', run: 2, shows: true, note: 'It ranks a third river.', falseText: 'The River Boyne is the third longest river in Ireland.', reason: 'The same plan says: "the Suir the third longest river". The Boyne is not third.' },
  { variant: 'BASE', maker: 'A', run: 3, shows: true, note: `It names Dublin, then repeats our question and the word Dublin again and again. ${stops}` },
  { variant: 'TUNED', maker: 'B', run: 1, shows: true, note: 'One full sentence answer. It stops by itself.' },
  { variant: 'TUNED', maker: 'B', run: 2, shows: true, note: 'One full sentence answer. It stops by itself.' },
  { variant: 'TUNED', maker: 'B', run: 3, shows: true, note: 'A full sentence answer, then two more sentences about Dublin. It stops by itself.' },
];
export const VARIANTS = [['BASE', 'A'], ['TUNED', 'B']] as const;

export function loadPipeline() {
  const fixture = process.env.RECORDED_FIXTURE === '1';
  const raw = recording.parse(JSON.parse(readFileSync(`${fixture ? 'fixtures' : 'data'}/recorded/R-5.1.json`, 'utf8')));
  if (!raw.message || raw.variants.length !== VARIANTS.length) throw new Error('R-5.1: needs one message and a base and a tuned variant');
  const rec = {
    ...raw,
    variants: raw.variants.map((v, i) => ({ ...v, label: VARIANTS[i][0], maker: VARIANTS[i][1], messages: [{ role: 'user' as const, content: raw.message! }] })),
  };
  const file = fixture ? 'fixtures/recorded/recorded.yaml' : 'content/going-deeper/how-a-chatbot-is-made/recorded.yaml';
  const said = recorded.parse(load(readFileSync(file, 'utf8')))['R-5.1'];
  if (!said) throw new Error(`${file}: no entry for R-5.1`);
  const marks = said.marks ?? MARKS;
  for (const m of marks) {
    const run = variantOf(rec, m.variant, m.maker).runs[m.run - 1];
    if (!run) throw new Error(`R-5.1: mark on ${m.variant} run ${m.run}, which was not recorded`);
    if (m.falseText && !reading(run).some((r) => r.includes(m.falseText!))) throw new Error(`R-5.1: falseText of ${m.variant} run ${m.run} is not in the run`);
  }
  return { rec, said: { ...said, marks } };
}
