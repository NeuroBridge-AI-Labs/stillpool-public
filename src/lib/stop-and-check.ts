// 4.5's "Stop and check": three invented scenarios, one at a time. The words are the lesson's own Simple text (pack rows
// F1 to F13). No person, place, account or event is real, and no real face or voice is used: each picture or sound is
// described in words. The outcome in each answer is invented and says so. Nothing here is scored, stored or sent.
import type { Case, Row } from './cases.ts';

export const QUESTION = "Is this real, fake, or can't tell yet?";
export const OPTIONS = ['Real', 'Fake', "Can't tell yet"];
export const INTRO = [
  'Here are three scenarios, one at a time. For each, pick real, fake or can\'t tell yet.',
  'We made them all up. No person, place or account in them is real. Each picture or sound is described in words.',
  'There is no score. You see our reading and the checks to make before you trust or share it, and you compare it with your pick.',
];
export const NOTES = [
  'In each case, the first honest answer was "can\'t tell yet". The checks came before any answer.',
  'Some files carry a content credential, a signed record of the file\'s history. If one is there, it is one more piece of evidence. If none is there, that shows nothing.',
  'These are three invented cases. They do not show how every fake looks or sounds.',
];

const reading = (why: string, checks: string, settled: string, ...rest: Row[]): Row[] => [
  { label: 'Our reading', text: why },
  { label: 'Checks before you trust or share', text: checks },
  { label: 'What you did next (invented)', text: settled },
  ...rest,
];

export const CASES: Case[] = [
  {
    heading: 'A photo in a group chat',
    scene: 'A friend sends a photo to a group chat. It shows a crowd outside a train station, with thick smoke behind it. The faces are sharp. The message says: "Is this happening now? Share it!" You do not know who took the photo.',
    answer: reading(
      "Can't tell yet, until you know where the photo came from. Sharp faces do not settle it. In one study, 315 people judged faces as real or computer-made. They matched the truth about half the time, close to chance.",
      'Ask who posted it, and where they got it. Look for the same photo or event somewhere else.',
      "Your friend got it from a stranger's post. A search finds no news of smoke. The station's own page says trains run as normal. The photo stays unshared.",
    ),
  },
  {
    heading: 'A voice message asking for money',
    scene: 'A voice message comes from a number you do not know. It sounds like your cousin. The voice says: "I am in trouble. I lost my phone. Please send money now."',
    answer: reading(
      "Can't tell yet, until you reach your cousin another way. The FBI, the US Federal Bureau of Investigation, warns that criminals can use AI-made audio to copy a relative's voice. In one study, listeners spotted fake clips about 7 times in 10.",
      "Do not reply to that number. Call your cousin on the number you already have. Ask for your family's secret word, if you made one.",
      'Your cousin picks up on the number you saved. They sent no message. You send no money.',
    ),
  },
  {
    heading: 'A video of a public figure',
    scene: 'A short video appears in your feed. It shows the mayor of an invented town, Elmford. The mayor says the town library will close next week. The voice and mouth seem to match. The account has no other posts.',
    answer: reading(
      "Can't tell yet, until you find the video's source. The studies here tested faces and voices, not video. They show that looking and listening are not a reliable check.",
      'Ask who posted it. Look for the same news elsewhere. Trace the clip back to where it first appeared.',
      "The council's own page says the library stays open. No other news website or channel has the clip. The clip stays unshared.",
    ),
  },
];
