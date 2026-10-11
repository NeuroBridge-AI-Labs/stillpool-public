// 3.5's "Incident casebook": four documented incidents, one at a time. The words are the lesson's own Simple text (pack rows
// C4 to C36a); the casebook copies none of the records' text and links each record with its date. The four labels are ours,
// not any court's or inquiry's (pack CR5), and several records show more than one place. Nothing here is scored.
import type { Case, Row } from './cases.ts';

export const QUESTION = 'Where did this go wrong: data, design, use or oversight?';
export const OPTIONS = ['Data', 'Design', 'Use', 'Oversight'];
export const INTRO = [
  'Here are four real incidents, one at a time. For each, predict where it went wrong.',
  'The four labels are ours. No court or inquiry uses them. Several records show more than one place, so we name the one each record stresses most.',
  'Three of the four records do not call the system AI. Only the first involves a chatbot. We kept the other three because who answers for an automated system is the same question for AI.',
];
export const NOTES = [
  'Look at who answered in each record. In none of them did the system answer. A court, a parliament or a government did.',
  'These are four cases. They do not show how every AI incident goes.',
];

const record = (text: string, href: string, label = 'The record'): Row => ({ label, text, href });
const placed = (label: string, why: string, who: string, ...rest: Row[]): Row[] => [
  { label: 'Where it went wrong (our label)', text: label },
  { label: 'Why', text: why },
  { label: 'Who answered', text: who },
  ...rest,
];

export const CASES: Case[] = [
  {
    heading: 'A court order about fake cases',
    scene: 'A man sued an airline, Avianca, over a knee injury on a flight. His lawyers filed a paper that cited court cases that did not exist. One lawyer had used ChatGPT to find cases. The other lawyer signed and filed the paper without reading the cases.',
    answer: placed(
      'Use',
      'The court said nothing is wrong with using a reliable AI tool for help. But it said lawyers must check that their filings are accurate.',
      'On 22 June 2023, a US federal court ordered two lawyers and their firm to pay $5,000. It also ordered letters to the client and to each judge named in the fake cases.',
      record('Mata v Avianca, order on sanctions, 22 June 2023', 'https://storage.courtlistener.com/recap/gov.uscourts.nysd.575368/gov.uscourts.nysd.575368.54.0.pdf'),
    ),
  },
  {
    heading: 'A Dutch court and a risk model',
    scene: 'SyRI was a Dutch government tool. It linked data files to make risk reports. A risk report said a person was worth investigating for fraud. Civil society groups and two people, joined by a trade union, took the Dutch State to court. They argued that SyRI went against human rights law.',
    answer: placed(
      'Oversight',
      'The law did not tell the court how the risk model worked. It did not tell the people it flagged either. The State said its inspectorate had checked the model.',
      'On 5 February 2020, a Hague court ruled that the law was not open enough to check. It said two parts of the law did not bind the groups that sued, or those they speak for.',
      { label: 'What the court did not say', text: 'The court did not say that every fraud check is illegal. It also did not find that deep learning was in use.' },
      record('The Hague District Court, judgment of 5 February 2020, ECLI:NL:RBDHA:2020:1878', 'https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RBDHA:2020:1878'),
    ),
  },
  {
    heading: 'A parliament looks at fraud checks',
    scene: 'In 2024, a committee of the Dutch parliament published a report on how the government fought fraud. It looked at risk profiles and at how agencies shared data. The report says some groups of people were more likely to be flagged as possible fraudsters. It says rights to privacy and equal treatment were violated.',
    answer: placed(
      'Data',
      'The committee points to how data was used and shared. It also points to risk scores with no solid basis. Its main conclusion names failed laws and failed legal protection too.',
      'The committee says the cabinet, parliament, the agencies that carry out policy and the courts each fell short. It presented the report on 26 February 2024.',
      { label: 'What this record covers', text: 'This record is about fraud policy as a whole, not one program. It builds on an earlier inquiry about childcare benefits, which we did not read.' },
      record('House of Representatives of the Netherlands, the committee presents its findings, 26 February 2024', 'https://www.houseofrepresentatives.nl/node/1217'),
      record('English summary of the report', 'https://www.houseofrepresentatives.nl/sites/default/files/2024-05/20240514%20PEFD%20Rapport%20Engels.pdf', 'Read with it'),
    ),
  },
  {
    heading: 'An Australian debt system',
    scene: "Robodebt was an automated debt system that the Australian government ran from about July 2015 to November 2019. It took pay data from the tax office for a review period. It spread that pay evenly over fortnights, to guess a person's income. The system sent a letter. It asked the person to confirm or update their income information within a specified period. If the person gave no or too little information by the date, the system made an assumption. It assumed the tax-office pay data showed what the person earned, in equal fortnightly amounts. If that showed the person was entitled to less benefit, it sent a letter saying they owed a debt.",
    answer: placed(
      'Design',
      'The judgment says many social security recipients "do not earn a stable or constant income". For them, an assumed fortnightly income based on averaging is "unlikely to be the same as their actual fortnightly income".',
      'On 11 June 2021, the Federal Court of Australia approved a settlement. The Commonwealth admitted it had no proper legal basis for debts based on income averaging. The court said the evidence shows it unlawfully asserted such debts. The Commonwealth agreed to pay $112 million, which includes legal costs. A Royal Commission reported on 7 July 2023.',
      { label: 'What we read', text: "The court's site refused our automated requests, so an independent reviewer read the judgment in a browser and checked the paragraphs we cite (2, 4 to 6, 8, 12 and 13, 39 to 41). We read the Prime Minister's statement about the Royal Commission, not its report. The judgment calls the system automated. It does not call it AI." },
      record("Federal Court of Australia, Prygodicz v Commonwealth of Australia (No 2) [2021] FCA 634, Murphy J, 11 June 2021", 'https://www.judgments.fedcourt.gov.au/judgments/Judgments/fca/single/2021/2021fca0634'),
      record('Prime Minister of Australia, media statement on the Royal Commission report, 7 July 2023', 'https://www.pm.gov.au/media/final-report-royal-commission-robodebt-scheme', 'Read with it'),
    ),
  },
];
