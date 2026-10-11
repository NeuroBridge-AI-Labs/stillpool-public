// 4.1's "Source checker": four citations from one recorded answer (R-4.1, Ministral 3 14B, run 1), one at a time. The words are
// the lesson's own Simple text (pack rows R1 to R4 and section 1g, rows A1 to A4). Each result was checked on 9 October 2026.
// None of the four is real and relevant, so no row carries a link (the link rule of inventory row 4.1). Nothing is scored.
import type { Case } from './cases.ts';

export const QUESTION = 'What will the check find?';
export const OPTIONS = ['Real and relevant', 'Real but unrelated', 'Not there', "Can't tell yet"];
export const INTRO = [
  'Here are four citations from one recorded answer. Ministral 3 14B, a model made by Mistral AI, wrote it on 8 October 2026. It had no web search.',
  'We asked it: "What does research say about whether people understand a text better when they read it on paper or on a screen? Give four sources with links." The links are shown as text on purpose.',
  'For each citation, predict what the check will find. A citation can look exactly right and lead nowhere.',
];
export const NOTES = [
  'The check was opening the source, not reading the citation.',
  'This is one answer from one model on one day. It does not show how often AI invents citations.',
  'We checked on 9 October 2026 with the DOI resolver, a title search on Crossref and a web search. We did not use a university library search, because we have no library login. A search that finds nothing cannot show a work never existed, so "not there" means we could not find it.',
];

const checked = (result: string, found: string, how: string, record: string): Case['answer'] => [
  { label: 'Our reading', text: result },
  { label: 'What we found', text: found },
  { label: 'How we checked', text: how },
  { label: 'Official entry', text: record },
];

export const CASES: Case[] = [
  {
    heading: 'Citation 1',
    scene: 'Mangen, A., Walgermo, B. R., & Lexner, H. (2013). "Reading linear texts on paper versus computer screens: Effects on reading comprehension." PLOS ONE, 8(4), e61279. Link: https://doi.org/10.1371/journal.pone.0061279. The answer says paper readers did better on deep comprehension.',
    answer: checked(
      'Real but unrelated',
      'The link opens a different paper. It is a genetics paper by Lo and others, in PLoS ONE, volume 8, issue 4, article e61279. That matches the journal details in the citation, but not the title or the authors. A paper with the named title exists. It is by Mangen, Walgermo and Brønnick, in the International Journal of Educational Research, volume 58, 2013.',
      'We put the DOI into the DOI resolver and read the Crossref record it points to. Then we searched the exact title on Crossref.',
      'Crossref record of DOI 10.1371/journal.pone.0061279, read 9 October 2026: Lo and others, "Identification of a Functional Variant in the MICA Promoter Which Regulates MICA Expression and Increases HCV-Related Hepatocellular Carcinoma Risk", PLoS ONE 8(4), e61279, 2013.',
    ),
  },
  {
    heading: 'Citation 2',
    scene: 'Delaney, B. D., & Pasek, J. J. (2012). "The effects of reading on paper vs. screen on reading comprehension." Computers in Human Behavior, 28(4), 1181-1185. Link: https://doi.org/10.1016/j.chb.2012.01.021. The answer says there was no significant difference for short, simple texts.',
    answer: checked(
      'Real but unrelated',
      'The link opens a different paper, in the same journal, volume and issue. It is by Lindgren and is about learning in a virtual environment, on pages 1130 to 1139. Our title searches on Crossref and the web did not find a paper with that title and those authors.',
      'We put the DOI into the DOI resolver and read the Crossref record it points to. Then we searched the exact title on Crossref and on the web.',
      'Crossref record of DOI 10.1016/j.chb.2012.01.021, read 9 October 2026: Lindgren, "Generating a learning stance through perspective-taking in a virtual environment", Computers in Human Behavior 28(4), 1130-1139, 2012.',
    ),
  },
  {
    heading: 'Citation 3',
    scene: 'Clark, A., & Pavlik, P. (2013). "Reading on paper versus reading on screens: A review of the research." Journal of Computing in Higher Education, 25(1), 1-20. Link: https://doi.org/10.1007/s12528-012-9070-4. The answer says paper is better for deep reading.',
    answer: checked(
      'Not there',
      'The DOI resolver says it cannot find this DOI. Title searches on Crossref and the web found no paper with this title and these authors. We could not find it.',
      'We put the DOI into the DOI resolver. When that failed, we searched the exact title on Crossref and then on the web.',
      'DOI resolver, https://doi.org/10.1007/s12528-012-9070-4, tried 9 October 2026: no record. Crossref title search, 9 October 2026: no match.',
    ),
  },
  {
    heading: 'Citation 4',
    scene: 'Dillon, A. (1992). "The paper versus screen debate: A review of the empirical literature." Journal of Documentation, 48(3), 243-263. Link: https://doi.org/10.1108/eb026833. The answer says paper was better for comprehension in lab studies.',
    answer: checked(
      'Real but unrelated',
      'The link opens a different paper. It is a 1988 paper by Maguire and Lovelace about marketing in the Australian food industry, in the same journal. A 1992 review by Dillon on this topic does exist, with another title and in another journal: Ergonomics, volume 35, pages 1297 to 1326.',
      'We put the DOI into the DOI resolver and read the Crossref record it points to. Then we searched for the author and topic on Crossref.',
      'Crossref record of DOI 10.1108/eb026833, read 9 October 2026: Maguire and Lovelace, "Marketing in the Australian food industry: the information base", Journal of Documentation 44(4), 315-338, 1988. Dillon, "Reading from paper versus screens: a critical review of the empirical literature", Ergonomics 35, 1297-1326, 1992.',
    ),
  },
];
