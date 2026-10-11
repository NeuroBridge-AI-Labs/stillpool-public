// 3.6's "Who made this?": five invented pieces of work, how to credit each, what its licence allows, and a one-line
// disclosure (pack rows A1 to A5). The pieces and people are invented; the licences are real, and each quote is the licence's
// own text (F17 to F19, F16, F20). Whether copyright exists in an AI-made part is not settled (F10 to F14): the answers for
// the AI-made pieces hold only where a licence reaches rights that exist and that the person holds. Nothing here is scored.
import type { Case } from './cases.ts';

export const QUESTION = 'How would you credit this?';
export const OPTIONS = ['Name the maker and the licence, and link the work.', 'No credit is needed.', 'Credit the AI tool only.', 'Say nothing: it is online.'];
export const INTRO = [
  'Here are five pieces of work. We invented every piece and every person. The licences are real ones.',
  'Some pieces are made by a person, some with AI\'s help, and some by AI. Each piece has its own permissions, and one has no licence at all, so each answer differs.',
];
export const NOTES = [
  'A disclosure line is one way to say it. Your course, your workplace or a publisher may have its own rule, so check it.',
  'A Creative Commons licence covers copyright and some similar rights. It does not cover other rights, such as privacy.',
  'This is not legal advice. Who owns AI-made work is not settled. The answers for the AI-made pieces hold only where the licence reaches rights that exist and that the person holds.',
];

const TASL = 'we recommend that the attribution include the Title, Author, Source, and License';
const SHARE_BY = 'reproduce and Share the Licensed Material, in whole or in part';
const SHARE_NC = 'reproduce and Share the Licensed Material, in whole or in part, for NonCommercial purposes only';
const NC = 'NonCommercial means not primarily intended for or directed towards commercial advantage or monetary compensation.';
const SA = "The Adapter's License You apply must be a Creative Commons license with the same License Elements, this version or later, or a BY-NC-SA Compatible License.";
const ROW = (label: string, text: string, quote = false) => ({ label, text, quote });

export const CASES: Case[] = [
  {
    scene: '"Harbour at Dawn" is a photo by Aoife Brennan. No AI was used. She shares it under CC BY 4.0.',
    answer: [
      ROW('Our answer', 'Name the maker and the licence, and link the work.'),
      ROW('Credit it like this', '"Harbour at Dawn" by Aoife Brennan, with a link to the photo, and CC BY 4.0 with a link to the licence.'),
      ROW('What the licence allows', 'Copy, share, change, even sell. You must credit her, link the licence and say if you changed it. You may not imply she endorsed you.'),
      ROW('The licence says', SHARE_BY, true),
      ROW('Creative Commons recommends', TASL, true),
      ROW('A one-line disclosure', '"Photo by Aoife Brennan. No AI used."'),
    ],
  },
  {
    scene: '"The water cycle: a study guide" is by the teacher Dara Okafor, who owns the guide. A chatbot shortened some sentences, and she checked each one. She shares it under CC BY-NC-SA 4.0.',
    answer: [
      ROW('Our answer', 'Name the maker and the licence, and link the work.'),
      ROW('Credit it like this', 'The title, Dara Okafor, a link to the guide, and CC BY-NC-SA 4.0 with a link to the licence.'),
      ROW('What the licence allows', 'Copy, share and change for non-commercial use only. Credit her. Share any changed version under the same licence.'),
      ROW('The licence says', SHARE_NC, true),
      ROW('Non-commercial means', NC, true),
      ROW('Changes must carry', SA, true),
      ROW('A one-line disclosure', '"Written by Dara Okafor. A chatbot helped shorten some sentences, and she checked each one."'),
    ],
  },
  {
    scene: '"Robot Lighthouse" is a picture made by an AI image tool, from a text request typed by Mei Tanaka. Mei chose to share it under CC0.',
    answer: [
      ROW('Our answer', 'No credit is needed. CC0 itself has no credit condition.'),
      ROW('Credit it like this', 'CC0 does not require credit. Good practice: name the person who made the request, and say it was made with an AI tool.'),
      ROW('What the licence allows', 'CC0 is a waiver, and it works to the greatest extent the law allows. Where it is effective for the rights Mei holds, CC0 itself puts no condition on use, including selling it, and asks for no credit. It does not clear other people\'s rights, and it does not cover patents or trademarks.'),
      ROW('The licence says', "To the greatest extent permitted by, but not in contravention of, applicable law, Affirmer hereby overtly, fully, permanently, irrevocably and unconditionally waives, abandons, and surrenders all of Affirmer's Copyright and Related Rights and associated claims and causes of action", true),
      ROW('A one-line disclosure', '"Made with an AI image tool from a request by Mei Tanaka."'),
    ],
  },
  {
    scene: '"Midnight Train" is a song by the band The Quiet Fields. No AI was used. It is all rights reserved: there is no licence.',
    answer: [
      ROW('Our answer', 'Name the band and the song, and link to it. Do not copy it without permission.'),
      ROW('Credit it like this', 'Name the band and the song when you mention or link it. There is no licence to name.'),
      ROW('What "all rights reserved" allows', 'No licence is given. For a use that copyright controls, such as copying or changing the song, you need the owners\' permission, unless an exception in the law applies. You can link to it.'),
      ROW('One real course words its own policy like this', 'Such content may not be reproduced, distributed or transmitted in any form or by any means without the prior written permission', true),
      ROW('A one-line disclosure', '"Song by The Quiet Fields. No AI used."'),
    ],
  },
  {
    scene: 'A chatbot made a short summary of the article "Tides of the Atlantic" by Seán Murphy, who shares it under CC BY-NC-SA 4.0. The summary copies several of the article\'s own sentences. Take it that this invented summary adapts protected expression from the article, so it needs the licence\'s permission, and no legal exception applies. A school blog with no ads or fees wants to post the summary.',
    answer: [
      ROW('Our answer', 'Name the maker and the licence, and link the work. Say the summary was made by AI.'),
      ROW('Credit it like this', 'The title and author of the article, a link to it, and CC BY-NC-SA 4.0 with a link to the licence. Say it is a summary made by AI.'),
      ROW('What the licence allows', 'Copying sentences does not by itself make a summary a changed version: that depends on whether it adapts protected expression, and an exception in the law can apply. Here we take it that it does adapt it and that no exception applies, so the licence is the permission, and it is for non-commercial use only. Credit Seán. Share the summary under the same licence, for the parts that reuse his article.'),
      ROW('The licence says', SHARE_NC, true),
      ROW('Changes must carry', SA, true),
      ROW('A one-line disclosure', '"Summary of Seán Murphy\'s article, made by a chatbot."'),
    ],
  },
];
