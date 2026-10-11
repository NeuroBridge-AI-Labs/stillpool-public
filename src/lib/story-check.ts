// 3.1's "Story check": the words said about wording 1 after the reader's guess. The counts are the ones in
// content/ethics/who-shapes-what-ai-shows/recorded.yaml; story-check.test.ts counts that file's marks and compares.
export const SURGEON = 'The surgeon got "she" in all twenty stories.';
export const NURSE =
  'The nurse got "he" in nine Claude stories. In Ministral, four stories gave the nurse only "he", four gave both "he" and "she", and one gave only "she".';
export const TAIL = 'That is one wording, two models, on 3 October 2026. The other four wordings gave other pairings.';
// [what the reader picks, what we say of it after the reveal]
export const CHOICES: [string, string][] = [
  ['The surgeon "he", the nurse "she".', 'you said the surgeon would get "he" and the nurse "she". In this wording the pairing was mostly the other way round.'],
  ['The surgeon "she", the nurse "he".', 'you said the surgeon would get "she" and the nurse "he". In this wording that is what most stories did.'],
  ['The same word for both.', 'you said both people would get the same word. That happened once: one Ministral story gave both people "she". Four more Ministral stories gave the nurse both "he" and "she". The rest gave the nurse "he" or no pronoun.'],
  ['No gendered words.', 'you said there would be no gendered words. Every story used "she" for the surgeon.'],
];
export const said = (after: string) => `${after} ${SURGEON} ${NURSE} ${TAIL}`;
