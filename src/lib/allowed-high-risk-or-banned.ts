// 3.7's "Allowed, high-risk or banned?": eight uses, in an order where no category shows three times in a row. The quotes
// are the EU legal text, consolidated version of 27 July 2026 (pack rows A1 to A8, F15 to F30); each says what it says for
// the use as described. "Allowed" is our word for a use on neither list. Nothing here is scored.
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Is this use banned, high-risk or allowed?';
export const OPTIONS = ['Banned', 'High-risk', 'Allowed'];
export const INTRO = [
  'Here are eight uses of AI in school and work. Each is a short description, so it is simpler than a real system.',
  '"Allowed" is our word. It means the use is on neither list. The Act has no category with that name.',
];
export const NOTES = [
  'A real system is judged on what it is intended to do. Article 6(3) can take some Annex III systems out of high-risk, and a system listed in Annex III that profiles people is always high-risk.',
  'This is not legal advice. The quotes are from the consolidated text of 27 July 2026, which says it has no legal effect itself, so each quote was also matched against the Official Journal text it comes from.',
];

const SOURCE: Row = { label: 'Source', text: 'Regulation (EU) 2024/1689, consolidated text of 27 July 2026, on EUR-Lex.' };
const ART_5F = 'the placing on the market, the putting into service for this specific purpose, or the use of AI systems to infer emotions of a natural person in the areas of workplace and education institutions, except where the use of the AI system is intended to be put in place or into the market for medical or safety reasons;';
const banned = (scene: string): Case => ({
  scene,
  answer: [
    { label: 'Category', text: 'Banned' },
    { label: 'Article', text: 'Article 5(1)(f), emotion inference in workplaces and education institutions' },
    { label: 'The text', text: ART_5F, quote: true },
    { label: 'Since when', text: 'The ban has applied since 2 February 2025.' },
    SOURCE,
  ],
});
const high = (scene: string, article: string, text: string): Case => ({
  scene,
  answer: [
    { label: 'Category', text: 'High-risk' },
    { label: 'Article', text: article },
    { label: 'The text', text, quote: true },
    { label: 'Since when', text: 'The main extra rules for these high-risk systems apply from 2 December 2027: Chapter III, Sections 1, 2 and 3, except Article 6(5) (Article 113(c)).' },
    SOURCE,
  ],
});
const allowed = (scene: string, article: string, text: string, duty: Row): Case => ({
  scene,
  answer: [
    { label: 'Category', text: 'Allowed: on neither list' },
    { label: 'Article', text: article },
    { label: 'The text', text, quote: true },
    duty,
    SOURCE,
  ],
});

export const CASES: Case[] = [
  high('A university uses AI to decide which applicants get a place.', 'Annex III, point 3(a), education and vocational training', 'AI systems intended to be used to determine access or admission or to assign natural persons to educational and vocational training institutions at all levels;'),
  allowed('A chatbot on a college website answers questions about library opening hours.', 'Article 50(1), AI that talks with people', 'Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system, unless this is obvious from the point of view of a natural person who is reasonably well-informed, observant and circumspect, taking into account the circumstances and the context of use.', { label: 'What the maker must do', text: 'Tell people they are talking with an AI, unless that is obvious.' }),
  banned("A school camera reads students' faces to guess if they feel angry or sad."),
  high("AI marks students' exam answers and sets their grades.", 'Annex III, point 3(b), education and vocational training', 'AI systems intended to be used to evaluate learning outcomes, including when those outcomes are used to steer the learning process of natural persons in educational and vocational training institutions at all levels;'),
  allowed('An image tool makes pictures for a school poster from a typed request.', 'Article 50(2), marking AI-made content', 'Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content, shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated.', { label: 'What the maker must do', text: 'Mark its pictures so a machine can detect them as AI-made. The rule is on the provider of the tool, not on the person who makes a picture.' }),
  high('AI sorts job applications and picks who gets an interview.', 'Annex III, point 4(a), employment and workers\' management', 'AI systems intended to be used for the recruitment or selection of natural persons, in particular to place targeted job advertisements, to analyse and filter job applications, and to evaluate candidates;'),
  banned("A company's software reads call-centre staff's faces during shifts to guess their mood."),
  high('AI watches students on a webcam during an exam and flags anyone who leaves their seat.', 'Annex III, point 3(d), education and vocational training', 'AI systems intended to be used for monitoring and detecting prohibited behaviour of students during tests in the context of or within educational and vocational training institutions at all levels.'),
];
