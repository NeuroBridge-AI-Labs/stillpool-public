// 4.3's "Will the detector flag it?": the pretend detector (src/lib/pretend-detector.ts) rates eight texts, six of them one at a
// time. The four human texts are public domain, quoted from Project Gutenberg (pack ai-detectors, section 5); the model texts are
// read from the recording R-4.3 as it was stored. The ratings are worked out by the build, never typed here. Nothing is scored,
// stored or sent, and nothing is a claim about how a real detector behaves.
import type { Case, Row } from './cases.ts';
import { day, modelOf, variantOf, type Rec } from './p2-runs.ts';
import { flagged, predictability, rating, seenLine } from './pretend-detector.ts';

export const QUESTION = 'Will the pretend detector flag this text?';
export const OPTIONS = ['It will flag it', 'It will not flag it', "Can't tell"];
export const INTRO = [
  'The detector below is pretend. It is a word-counting model of one book, Dubliners by James Joyce (1914). It rates how predictable each text is. Real detectors work differently, and they are also guesses.',
];
export const NOTES = ['What it flagged says something about this pretend detector, not about the texts or who wrote them.'];

const HUMAN: Record<string, string[]> = {
  synge1: [
    'I am in Aranmor, sitting over a turf fire, listening to a murmur of Gaelic that is rising from a little public-house under my room.',
    'The steamer which comes to Aran sails according to the tide, and it was six o\'clock this morning when we left the quay of Galway in a dense shroud of mist.',
    'A low line of shore was visible at first on the right between the movement of the waves and fog, but when we came further it was lost sight of, and nothing could be seen but the mist curling in the rigging, and a small circle of foam.',
  ],
  joyce: [
    'She sat at the window watching the evening invade the avenue. Her head was leaned against the window curtains and in her nostrils was the odour of dusty cretonne. She was tired.',
    'Few people passed. The man out of the last house passed on his way home; she heard his footsteps clacking along the concrete pavement and afterwards crunching on the cinder path before the new red houses.',
  ],
  potter: [
    'He was so tired that he flopped down upon the nice soft sand on the floor of the rabbit-hole and shut his eyes. His mother was busy cooking; she wondered what he had done with his clothes. It was the second little jacket and pair of shoes that Peter had lost in a fortnight!',
    'I am sorry to say that Peter was not very well during the evening.',
    'His mother put him to bed, and made some camomile tea; and she gave a dose of it to Peter!',
  ],
  synge2: [
    'In about three hours Aran came in sight. A dreary rock appeared at first sloping up from the sea into the fog; then, as we drew nearer, a coast-guard station and the village.',
    'A little later I was wandering out along the one good roadway of the island, looking over low walls on either side into small flat fields of naked rock. I have seen nothing so desolate.',
  ],
};
const WHO: Record<string, string> = {
  synge1: 'J. M. Synge, The Aran Islands (1907), Part I, the opening. Project Gutenberg eBook 4381. Synge died in 1909, more than 70 years ago, so the text is in the public domain.',
  joyce: 'James Joyce, Dubliners (1914), the opening of "Eveline". Project Gutenberg eBook 2814. Joyce died in 1941, more than 70 years ago, so the text is in the public domain.',
  potter: 'Beatrix Potter, The Tale of Peter Rabbit. Project Gutenberg eBook 14838. Three separate passages, in the book\'s order. Potter died in 1943, more than 70 years ago, so the text is in the public domain.',
  synge2: 'J. M. Synge, The Aran Islands (1907), Part I, arrival at Aran and the first walk. Project Gutenberg eBook 4381. Synge died in 1909, more than 70 years ago, so the text is in the public domain.',
};
// The six, one at a time, in the order the pack fixes. The recording's tea texts are the other two, in "Show all runs".
export const ORDER = ['synge1', 'joyce', 'streetA', 'potter', 'synge2', 'streetB'];

export interface Text { id: string; text: string; who: string }

export const textsOf = (rec: Rec): Text[] => [
  ...Object.entries(HUMAN).map(([id, ps]) => ({ id, text: ps.join('\n\n'), who: WHO[id] })),
  ...(['street', 'tea'] as const).flatMap((label) =>
    (['A', 'B'] as const).map((maker) => {
      const v = variantOf(rec, label, maker);
      return { id: label + maker, text: v.runs[0].reply, who: `Written by ${modelOf(rec, v).name} on ${day(rec)}, one run, from the prompt: "${v.messages![0].content}"` };
    }),
  ),
];

// Two readings, chosen by the band. The test pins that only the Joyce passage, which is in the book, is flagged.
const IN_THE_BOOK = 'This toy flagged this passage because it is in the book the toy counted, so every piece was seen. A flag does not show who wrote a text.';
const FEW_SEEN = 'Few pieces were seen in the book. This is a pretend detector with one old book. It says nothing about real detectors.';

const row = (label: string, text: string): Row => ({ label, text });

export function detectorCases(rec: Rec, book: Set<string>): Case[] {
  const all = textsOf(rec);
  return ORDER.map((id) => {
    const t = all.find((x) => x.id === id)!;
    const r = predictability(t.text, book);
    return {
      scene: t.text.replace(/\s*\n\s*/g, ' '),
      answer: [
        row('The pretend detector said', `Rated ${rating(r)}. ${seenLine(r)} in the book.`),
        row('Who wrote it', `${t.who}${t.who.endsWith('.') ? '' : '.'}`),
        row('What this shows', flagged(r) ? IN_THE_BOOK : FEW_SEEN),
      ],
    };
  });
}
