// 5.6's "Which tool for the job?": six invented jobs. Every reading is ours, built from OpenAI's and Anthropic's own pages and two
// studies (pack docs/packs/going-deeper/prompt-rag-or-fine-tune.md, rows P1 to P32, read 9 October 2026). None is a rule from a maker.
// No company, person or number of tickets is real, and nothing here is scored, stored or sent.
import type { Case } from './cases.ts';

export const QUESTION = 'Which tool fits this job best?';
export const OPTIONS = ['Prompt it', 'Give it documents (RAG)', 'Fine-tune it', 'Start with a prompt, then test'];
export const INTRO = [
  'We made up six jobs. Nothing in them is real: no company and no person.',
  'For each job, pick the tool you think fits best. Then read our reading and the reasons.',
  'Our readings come from guides by OpenAI and Anthropic, and from two studies. They are ours, not rules from any maker. A team with different test results could choose differently.',
];
export const NOTES = [
  'In every job, a test comes before the choice. The simple way comes first, and a test says if it is enough.',
  'In OpenAI\'s guide the tools can be combined, so a real job may end with more than one.',
  'These are six invented jobs. They do not cover every job. The guides can change, so check the maker\'s page on the day.',
];

const reading = (tool: string, why: string, changes: string, cost: string, test: string): Case['answer'] => [
  { label: 'Our reading', text: tool },
  { label: 'Why', text: why },
  { label: 'What it changes', text: changes },
  { label: 'Cost and data', text: cost },
  { label: 'How we would test it', text: test },
];

export const CASES: Case[] = [
  {
    scene: 'A team wants a short summary after each meeting. They paste in the meeting notes and ask for five bullet points. Nothing else is needed.',
    answer: reading(
      'Prompt it',
      'OpenAI\'s guide says prompting is often the only method needed for summaries, translation and code.',
      'The input only. You write instructions and, if needed, one example of a good summary.',
      'No training and no store of documents. You write the prompt and check it.',
      'Take ten past meetings where the team knows what mattered. Check that each summary has those points and no invented ones.',
    ),
  },
  {
    scene: 'A company wants staff to ask questions about its 300-page human resources (HR) handbook, which holds staff policies. The handbook changes every month. Staff need answers that match this month\'s text.',
    answer: reading(
      'Give it documents (RAG)',
      'The facts are private and they change. OpenAI\'s guide lists out-of-date and private knowledge as reasons to send the model better background, such as documents. Anthropic\'s glossary says RAG suits tasks that need up-to-date information.',
      'The input. The system finds the right pages for each question and sends them with it.',
      'The handbook must be searchable and updated each month.',
      'Ask questions with known answers from this month\'s handbook, including what changed. Were the right pages found? Does the answer match them?',
    ),
  },
  {
    scene: 'A publisher wants every reply from its chat helper to follow its house style: short sentences, a friendly greeting and no jargon.',
    answer: reading(
      'Start with a prompt, then test',
      'In OpenAI\'s guide, style is a behaviour problem. It says a few examples in the prompt should make results more consistent. Training comes later.',
      'First the input only: the style rules and a few example replies. Consider training only if the style still slips.',
      'A few good example replies and the written style rules. Training would need many more examples.',
      'Write test requests. Check each reply against the style rules. If many miss, add examples and test again.',
    ),
  },
  {
    scene: 'A support team sorts tickets into eight types. A ticket is a recorded request for help. A prompt with examples, tried on 200 tickets with known types, keeps mixing up two types. Staff have already sorted thousands of past tickets.',
    answer: reading(
      'Fine-tune it',
      'The prompt was tested. The problem is steady behaviour, not missing facts. OpenAI\'s pages list classification as a use of fine-tuning. Sorting these tickets into types is classification.',
      'The model. It trains on correctly sorted tickets.',
      'It needs correct examples that look like real tickets. Here they exist. Training is a separate job. OpenAI\'s guide advises starting with about 50 good examples.',
      'Hold some sorted tickets back from training. Compare the new model with the prompt on them.',
    ),
  },
  {
    scene: 'A law firm wants an assistant that can answer questions from its 2,000 case files. A colleague says to fine-tune the model on all of them.',
    answer: reading(
      'Give it documents (RAG)',
      'Two studies found fine-tuning a weak way to add facts. One found RAG did better in its tests. The other found new facts are learned slowly, then make wrong answers more likely. One study tested three models and the other tested one.',
      'The input. The system looks up the files for each question.',
      'The files must be searchable. A new or changed file is added to what the system searches.',
      'Ask questions the files answer, and some they do not. Check that answers match the files.',
    ),
  },
  {
    scene: 'A school wants a kind, plain homework helper. It must follow the school\'s policy pages on when to ask a teacher.',
    answer: reading(
      'Start with a prompt, then test',
      'The job has a facts part (policy) and a behaviour part (tone). OpenAI\'s guide says to find which part fails, then pick the fix that fits.',
      'First the input: tone instructions and the policy pages. Add more only if the test shows a need.',
      'A prompt is the least to try. Add document search if facts go missing, training if tone slips.',
      'Test policy and tone questions. Mark each miss as wrong fact or wrong tone. Change one thing, then test again. Adding RAG can lower a score, as in OpenAI\'s own example.',
    ),
  },
];
