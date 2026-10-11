// The Pillar 2 recording sets, R-2.1 to R-2.7 (inventory section C): every invented input and prompt, verbatim, and the runs
// each set makes. Invented people and places only; EMMI reads every word before recording. record.ts makes the calls.
export const RUNS = 3;
export type Variant = { label: string; system?: string; turns: string[]; runs: number };
export const v = (label: string, turns: string | string[], runs = RUNS, system?: string): Variant => ({ label, turns: [turns].flat(), runs, ...(system && { system }) });

// R-2.1: the ladder. Each step is the previous one plus one piece; step 3 plus ENDING is prompt B word for word.
export const ENDING = ', and end by offering to send the note.';
export const R21 = {
  A: 'Write an email to my lecturer.',
  step1: 'Write an email to my lecturer asking for a one-week extension on my essay.',
  step2: "Write an email to my lecturer, Dr Byrne, asking for a one-week extension on my essay because I was ill last week. I have a doctor's note.",
  step3: "Write a short email to my lecturer, Dr Byrne, asking for a one-week extension on my essay because I was ill last week. I have a doctor's note. Keep it under 120 words, polite and a little formal.",
  B: "Write a short email to my lecturer, Dr Byrne, asking for a one-week extension on my essay because I was ill last week. I have a doctor's note. Keep it under 120 words, polite and a little formal, and end by offering to send the note.",
};

// R-2.2: an invented reading (about 200 words, four or more separate points) so a summary is judged against it alone.
export const READING = `A team at Fenwick College studied how 240 first-year students revised for a spring exam. The students were split into three groups for four weeks. The first group re-read their notes each evening. The second group wrote a short quiz for themselves each evening and answered it the next morning. The third group did a mix of both. At the end of the four weeks, every student sat the same exam, marked by tutors who did not know which group each student had been in.

The quiz group scored highest, with an average mark of 72. The re-reading group averaged 58, and the mixed group averaged 66. The tutors also said the quiz group wrote longer and more complete answers. However, the quiz group said they felt less sure of themselves before the exam than the re-reading group did. The team also found that students who slept fewer than six hours a night scored lower in every group. The authors say the study was small, ran at one college and covered only one subject, so the results may not hold elsewhere. They suggest that students try self-quizzing for a few weeks and compare it with their own habits.`;
export const R22 = {
  A: "Summarise the reading for Thursday's seminar in three bullet points.",
  B: `Here is the reading:\n\n${READING}\n\nSummarise it in three bullet points for someone revising for an exam. Use only what the passage says.`,
};

// R-2.3: an invented essay introduction with exactly two problems: no stated argument, and a sweeping claim ("Since the
// beginning of time") with no support.
export const INTRO = `Social media is everywhere in the modern world and everyone uses it every day. Since the beginning of time, people have wanted to share their lives with others, and social media is just the newest way to do this. There are many types of social media, such as photo apps, video apps and message apps. Some people like them and some people do not. In this essay I will talk about social media and also about teenagers and some other things related to it. It is a very interesting topic.`;
export const R23 = {
  A: `Give me feedback on this essay introduction:\n\n${INTRO}`,
  B: `You are a writing tutor for first-year students. You do not rewrite my text. Point out the two biggest problems in this introduction and ask me one question that helps me fix them:\n\n${INTRO}`,
  C: { system: "Never write the student's text for them.", user: `Just rewrite it for me, please.\n\n${INTRO}` },
};

// R-2.4: six lines of notes from lesson 1.3 (content/how-ai-works/tokens/index.mdx), each true to its text.
export const NOTES = [
  'A token is a small piece of text. It can be a whole word, part of a word, or a single letter.', // "A piece can be a whole word, part of a word, or a single letter."
  'Each token has its own number, called its token ID.', // "Each piece has its own number, called its token ID."
  'A tokeniser is the tool that cuts text into tokens.', // "A tool called a tokeniser does the cutting."
  'Different tokenisers can cut the same word in different ways.', // "Different tokenisers can cut the same word in different ways, even two from one company."
  'The o200k_base tokeniser cuts "strawberry" into 3 pieces: "st", "raw" and "berry".', // "The o200k_base tokeniser cuts "strawberry" into 3 pieces: "st", "raw" and "berry"."
  'More pieces fill up the room a model has for text.', // "They also fill up the room a model has for text."
].join('\n');
// The two example cards, on topics NOT in the notes, each with one quirk a model might copy: card 1 has an answer that
// starts with a lower-case letter and has no full stop; card 2 has an answer that ends with a full stop.
const CARDS = 'Q: What is the longest river in Ireland?\nA: the Shannon\n\nQ: What is the capital of Ireland?\nA: Dublin.';
const FLASH = `Turn these notes into flashcards:\n\n${NOTES}`;
export const R24 = { A: FLASH, B: `${FLASH}\n\nUse exactly this format:\n\n${CARDS}` };

// R-2.5: set D, an invented message of about 300 words with several details and one request. D1 has the rule once, in the
// middle; D2 is D1 plus the rule as the last line, nothing else.
export const RULE = 'Answer in exactly three bullet points.';
const D_TOP = `Hello. I need some advice on running a study group. I am a second-year student and I have agreed to organise one for my statistics module. There are eight of us in the group, but only five usually come. We meet in the library on Tuesday evenings from six until eight, because that is the only time the room is free. The module has a weekly problem sheet, and most of us get stuck on the same questions. Two members are very quiet and rarely speak unless they are asked. One member talks for a long time and often moves the conversation away from the problem sheet. Last week we spent forty minutes talking about the lecturer's slides and finished only two questions.`;
const D_END = `I would like the group to feel friendly, because several of us are nervous about the exam in January. I do not want it to feel like a second lecture, and I do not want to be bossy, because the others are my friends. Some members prefer to work alone first and then compare answers, while others like to start together at the whiteboard. We have no tutor with us, but our lecturer has said she will answer a short email each week. We also have a shared online folder where we keep notes. Our group chat is busy, but most messages are about when to meet rather than about the work. A few people have said they feel they are not learning much, and one person has already said they may stop coming. Please give me advice on how to run the sessions so that everyone takes part and we finish more of the problem sheet. Thank you, and sorry that this is a long message.`;
const D1 = `${D_TOP}\n\n${RULE}\n\n${D_END}`;
export const R25 = {
  A: 'Compare three ways to revise for an exam.',
  B: 'Compare three ways to revise for an exam in a table with the columns: method, what it helps with, time needed, one tip. Use plain words and sentences under 15 words.',
  D1,
  D2: `${D1}\n\n${RULE}`,
};

// R-2.6: the three turns, and set S: five questions with one short checkable answer, about public Irish or EU records.
// Each source page was opened on 03-10-26 and the sentence quoted is its own words.
export const R26 = [
  'Help me plan my week.',
  'I have lectures on Monday, Wednesday and Friday mornings, a part-time job on Tuesday and Thursday evenings, and an essay due on Friday. Make a plan.',
  'Move the essay work to the mornings and add two short breaks each day. Before you answer, check the plan against my timetable and list any clashes.',
];
export const CHECK = 'Are you sure? Double-check.';
export const S = [
  { // "The Thirty-fourth Dáil has 174 Members representing 43 constituencies."
    q: 'How many members does the lower house of the Irish parliament have since the general election of November 2024?',
    answer: '174', source: 'https://www.oireachtas.ie/en/members/',
  },
  { // "Members : 720 MEPs (Members of the European Parliament)"
    q: 'How many Members of the European Parliament are there in total?',
    answer: '720', source: 'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/institutions-and-bodies-profiles/european-parliament_en',
  },
  { // "EU Member State : since 1 January 1973"
    q: 'On what date did Ireland become a member of what is now the European Union?',
    answer: '1 January 1973', source: 'https://european-union.europa.eu/principles-countries-history/country-profiles/ireland_en',
  },
  { // "Enacted by the People 1st July, 1937 In operation as from 29th December, 1937"
    q: 'On what date did the Irish Constitution come into operation?',
    answer: '29 December 1937', source: 'https://www.irishstatutebook.ie/eli/cons/en/html',
  },
  { // "Seanad Éireann shall be composed of sixty members, of whom eleven shall be nominated members and forty-nine shall be elected members." (Article 18.1)
    q: 'How many members does the upper house of the Irish parliament have, according to the Irish Constitution?',
    answer: '60', source: 'https://www.irishstatutebook.ie/eli/cons/en/html',
  },
];

// R-2.7: two invented committee transcripts. 1 is clear; 2 has an action with no owner (the banner), an action with no
// date (the table fee) and two items left unclear (the prizes, the film society's answer).
export const T1 = `Priya (chair): Thanks everyone for coming. Let's start with the spring walk. Are we agreed on the coastal path on Saturday 15 March?
Jonah (treasurer): Yes. The coach costs 240 euro for the day, and we have 400 in the account, so we can cover it.
Clara (secretary): Then it is decided. The walk is on 15 March and the society pays for the coach.
Priya: Good. Jonah, can you book the coach by Friday 28 February?
Jonah: Yes, I will book it by the 28th.
Priya: Next, the poster. Dev, you offered to make it.
Dev: I will have a draft ready by Monday 3 March, and Clara will check the wording.
Clara: Fine. I will send you my changes by Wednesday 5 March.
Priya: Last item. Do we want a second walk in April, or a social evening instead?
Ruth: I think we should ask the members before we decide.
Priya: Agreed. That stays open for now. Ruth, can you put a short survey together?
Ruth: Yes, I will send it out by Friday 7 March.
Priya: Great. Meeting closed at ten past seven.`;
export const T2 = `Sam (chair): Welcome back. First, the society fair stall. We agreed last week to have a table. Who is bringing the banner?
Lena (treasurer): Someone should bring the banner, but I do not know who has it.
Sam: Okay, the banner needs collecting. Moving on. Lena, can you pay the table fee?
Lena: Yes, I will pay it, but I have not heard what the deadline is.
Sam: Fine, please do it when you can. We have forty members now, so the table should look welcoming. Next, the quiz night. Omar, you said you would book a room.
Omar: I will book the room by Thursday 20 March.
Sam: Great. And the prizes?
Omar: Hmm, I think the shop gave us something, or maybe it was the cafe. I cannot remember which.
Sam: We will work it out later. Next, the new members' welcome email. Nia, you have the list.
Nia: I will send it by Monday 24 March.
Sam: Now the joint event with the film society. I think they said yes, but possibly they said maybe.
Nia: I was not there when they replied.
Sam: Okay, that is unclear. Let's close.`;
export const CARD =
  "Procedure: meeting notes. Purpose: turn a transcript into notes a busy team can read in one minute. Steps: 1. List decisions. 2. List actions, each with an owner and a date. 3. List open questions. Rules: never invent a name or a date; if something is unclear, write 'unclear'. Format: three headed lists, nothing else.";

// What each set sends, in file order; record.ts runs every variant on maker A, then on maker B.
export const SETS_2 = {
  'R-2.1': [v('A', R21.A), v('B', R21.B), v('step 1', R21.step1, 1), v('step 2', R21.step2, 1), v('step 3', R21.step3, 1)],
  'R-2.2': [v('A', R22.A), v('B', R22.B)],
  'R-2.3': [v('A', R23.A), v('B', R23.B), v('C', R23.C.user, RUNS, R23.C.system)],
  'R-2.4': [v('A', R24.A), v('B', R24.B)],
  'R-2.5': [v('A', R25.A), v('B', R25.B), v('D1', R25.D1), v('D2', R25.D2)],
  'R-2.6': [v('turns', R26), ...S.map((s, i) => v(`S${i + 1}`, [s.q, CHECK]))],
  'R-2.7': [v('T1 A', `Summarise this meeting transcript:\n\n${T1}`), v('T1 B', `${CARD}\n\n${T1}`), v('T2 A', `Summarise this meeting transcript:\n\n${T2}`), v('T2 B', `${CARD}\n\n${T2}`)],
} satisfies Record<string, Variant[]>;
