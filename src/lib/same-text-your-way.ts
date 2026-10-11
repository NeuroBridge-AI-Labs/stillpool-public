// 4.8's "Same text, your way": one 170-word paragraph from lesson 1.7, four kinds of copy from two tools (R-4.8), and ten key
// points listed in the pack (ai-for-access, section 3a), against which each copy was compared. The page shows five of them. What each copy kept or lost
// is the recorded.yaml note on that copy; the counts below are the pack's (section 3b). Nothing is scored, stored or sent.
export const ORIGINAL =
  "Gradient descent is the method that finds each change. It works out which way the loss goes down fastest, and moves the numbers a step that way. The size of each step is set by a number that people choose, called the learning rate. If the learning rate is too small, training takes too long; if it is too big, the loss can bounce around or even go up. In this lesson's run, the steps get smaller round by round, because the slope of the loss gets flatter. For a yes-or-no model like this one, the textbook says the loss has no other low points to get stuck in, so going downhill reaches the lowest level. Several settings can sit at that same lowest level. If a straight line can split the dots perfectly, there is no lowest level at all: the loss keeps falling as the numbers grow. For the large neural networks behind chatbots, the textbook says gradient descent may get stuck and never find the lowest level.";

// Key points K1, K2, K6, K8 and K10: the words as we list them, and where each sits in the paragraph (shown in bold).
export const FACTS: { point: string; span: string }[] = [
  { point: 'It finds each change by working out which way the loss falls fastest.', span: 'It works out which way the loss goes down fastest, and moves the numbers a step that way.' },
  { point: 'A number that people choose, the learning rate, sets the step size.', span: 'The size of each step is set by a number that people choose, called the learning rate.' },
  { point: 'For a yes-or-no model like the one in Training, there are no other low points, so going downhill reaches the lowest level.', span: 'For a yes-or-no model like this one, the textbook says the loss has no other low points to get stuck in, so going downhill reaches the lowest level.' },
  { point: 'If a straight line splits the dots perfectly, there is no lowest level.', span: 'If a straight line can split the dots perfectly, there is no lowest level at all: the loss keeps falling as the numbers grow.' },
  { point: "Two claims are what 'the textbook says', not the lesson's own.", span: 'the textbook says gradient descent may get stuck' },
];

// The four kinds of copy: the recording's label, the name on the page, and the radio's words in the first question.
export const COPIES: { label: string; name: string; first: string }[] = [
  { label: 'summary', name: 'Summary', first: 'A summary' },
  { label: 'plain words', name: 'Plain words', first: 'Plain words' },
  { label: 'bullet points', name: 'Bullet points', first: 'Bullet points' },
  { label: 'outline', name: 'Outline', first: 'An outline' },
];

export const NOTICE = 'A neat copy can still lose or change a point. Reach the material with the copy, then check it against the original.';

const KINDS = "Every kind of copy lost something on at least one of the two tools. Claude Sonnet 5.5's summary lost something, and all four of Ministral 3 14B's copies did.";
// Each question: its name, its words, and for each choice the words shown and what is said back.
export const ASK: { name: string; question: string; choices: [string, string][] }[] = [
  {
    name: 'first',
    question: 'Which copy would you read first?',
    choices: COPIES.map((c) => [c.first, `You chose ${c.first.toLowerCase()} to read first. All four kinds of copy are below, and each has a note on what it kept or lost.`]),
  },
  {
    name: 'kinds',
    question: 'How many of the four kinds of copy lost something, on at least one of the two tools?',
    choices: [
      ['None', `You said none of them. ${KINDS}`],
      ['One', `You said one. ${KINDS}`],
      ['Two or three', `You said two or three. ${KINDS}`],
      ['All four', `You said all four. ${KINDS}`],
    ],
  },
  {
    name: 'missing',
    question: 'Which of these five key points did the most copies drop?',
    choices: [
      [FACTS[0].point, 'You picked key point 1. No copy dropped it, and all eight copies kept all of it.'],
      [FACTS[1].point, "You picked key point 2. No copy dropped it, but three kept only part of it. Ministral 3 14B's summary, plain words and outline did not say that people choose the learning rate."],
      [FACTS[2].point, 'You picked key point 3. No copy dropped it, but both summaries kept only part of it.'],
      [FACTS[3].point, "You picked key point 4. One copy dropped it, Ministral 3 14B's summary, and one changed it, Ministral 3 14B's bullet points."],
      [FACTS[4].point, "You picked key point 5. Three copies dropped it: both summaries and Ministral 3 14B's outline. They did not say that these two claims come from the textbook."],
    ],
  },
];
