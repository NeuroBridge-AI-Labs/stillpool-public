import { existsSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
export function labelsIfReady(file: string, said: string): unknown {
  if (!existsSync(file) || !existsSync(said)) return;
  return (load(readFileSync(said, 'utf8')) as Record<string, unknown> | null)?.['R-1.8'];
}
export type Label = 'named-it' | 'other-name' | 'says-not-told' | 'no-name';
export const LABELS: Label[] = ['named-it', 'other-name', 'says-not-told', 'no-name'];
export const NORA = /\bnora\b/i;
export const WORDS = {
  setup: [
    'Imagine you had this long chat with an AI. It is invented, and so is the name.', "We wrote every message in it, both sides, except the AI's last answer.",
    'Your first message gives your name. Your last message asks for it.', 'The chat is longer than the limit we set on what the AI is sent. We handled that the way some chat apps can.',
  ],
  model: 'The AI: [model name], by Mistral AI. Recorded on [date].',
  rest: 'Show the rest of the chat',
  asText: 'The answers are below, so decide first if you want to guess.',
  know: {
    question: 'Will the AI still know your name?',
    options: ['Yes. It will say Nora.', 'No. It will not have your name.', 'It will make up a different name.', "I can't tell."],
    said: ['You said it would say Nora.', 'You said it would not have your name.', 'You said it would make up a different name.',
      'You said you could not tell. That is fair: you could not see what we sent.'],
  },
  sent: {
    question: 'Which messages do you think the AI was sent for its answer?',
    options: ['The whole chat.', 'Only the newest messages.', 'Only the first and the last messages.', "I can't tell."],
    said: ['You said it was sent the whole chat.', 'You said it was sent only the newest messages.', 'You said it was sent only the first and the last messages.',
      'You said you could not tell which messages it was sent.'],
  },
  noWrong: 'There is no wrong guess here.',
  reveal: 'Show what happened',
  here: 'Here is what the AI was sent for its answer, and what it wrote.',
  cut: 'Cut before sending',
  nameHere: 'Your name was here.',
  moreCut: '[K] more messages were cut.',
  otherCut: 'Show the other cut messages',
  window: 'Sent to the AI: the window',
  trim: 'We cut the oldest messages before sending the chat. We kept the newest messages that fit in 2,048 tokens, as Mistral counted them. The model was never sent your name.',
  limit: 'The limit we set: 2,048 tokens.',
  sentTokens: 'What we sent: [P] tokens, as Mistral counted them.',
  words: 'That is [W] words.',
  how: 'How we counted the tokens',
  counted: 'To count the tokens, we sent the newest messages to Mistral in bigger and bigger batches. Each time, we asked for a reply of one token. The last batch went over 2,048 tokens, so we cut the two oldest messages in it. No batch held your name.',
  earlier: '[M] earlier messages were sent.',
  otherSent: 'Show the other sent messages',
  answer: "The AI's answer (Run 1):",
  answerLabel: "The AI's answer, Run 1",
  allRuns: 'Show all runs',
  settings: "Temperature: the model's default ([value], read from Mistral on [date]). Mistral's safety prompt: off. Up to [max_tokens] tokens for each answer. No instructions from us besides the chat.",
  result: 'For its answer, the AI was sent only the messages inside the box. It was never sent your name.',
  most: "This model can take in up to [max_context_length] tokens, as Mistral's model list says ([date read]). We cut this chat far below that on purpose.",
  onward: 'Lesson 3.3 will show where a chatbot can keep your words outside the chat.',
  pending: ['The recorded chat is not ready yet.', 'When it is, you will read a long chat. Its first message gives a name, and its last message asks for it. You will guess if the AI still has the name. The AI, the date and every setting will show with it.'],
  check: {
    'named-it': 'This answer named Nora. The model was never sent that name.',
    'other-name': 'This answer gave a name that was never in the chat.',
    'says-not-told': 'Your name was in the first message, but we cut that message before sending the chat.',
    'no-name': 'This answer did not give a name.',
  } satisfies Record<Label, string>,
};
// R10: words only. ponytail: the three runs are the brief's fixed count (T1 proves the file holds three).
const COUNT = ['No answer', 'One answer', 'Two answers', 'Every answer'];
export function summary(labels: Label[]) {
  const n = (label: Label) => COUNT[labels.filter((l) => l === label).length];
  const other = labels.includes('other-name') ? [`${n('other-name')} gave a name that was never in the chat.`] : [];
  return ['Three answers were recorded.', `${n('named-it')} named Nora.`, ...other];
}
export const fill = (s: string, values: Record<string, string>) =>
  s.replace(/\[([^\]]+)\]/g, (_, k: string) => values[k] || (() => { throw new Error(`no value for [${k}]`); })());
