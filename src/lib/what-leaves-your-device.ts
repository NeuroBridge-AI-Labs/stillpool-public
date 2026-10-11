// 3.3's "What leaves your device": a toy with a mock chat and three places that hold what you typed, then the live list of
// what this page loaded, read from the browser's own record: the page itself (`getEntriesByType('navigation')`) and the files
// it asked for (`'resource'`). The toy is invented and follows our own rules, not any product's (pack A1 to A6). The list shows
// addresses and sizes, never what a request carried (MDN, PerformanceResourceTiming), and the toy makes no request of its own.
export const CHAT = ['My cat is called Biscuit.', 'I am learning to bake bread.', 'Please remember that I like short answers.', 'Delete this chat.'];
export const HOLDS = ['Nothing', 'One line', 'All four lines'];
// Each place, and what it holds next week in the toy's rules (the lesson's Deep layer), with why.
export const PLACES: { name: string; holds: number; text: string }[] = [
  { name: 'This chat', holds: 0, text: 'A new chat starts without the old lines. The old chat ended when it was closed.' },
  { name: 'Saved memory', holds: 1, text: 'Line 3, "Please remember that I like short answers." It is the one the user asked the bot to remember. Line 4, "Delete this chat.", does not delete it. Memory has its own controls.' },
  { name: 'Company logs', holds: 2, text: 'All four lines, for a set time after the chat is deleted. In our toy the company sets that time, and we show no number. A real company sets its own.' },
];
export const WHY = 'Three places have three different rules. Deleting a chat is not the same as erasing every copy.';
export const HOW_MANY = ['Fewer than 5', '5 to 20', 'More than 20'];
export const WHO = ["Only to this site's own server.", 'To this site and to some other companies.', "I can't tell."];
export const COUNT_NOTE =
  'In a build with the count switched on, a finish page also loads a small counting script and sends one anonymous page-view message. This page is not a finish page.';
// What the list is, said after it: a snapshot of the browser's record, not a count of everything that crossed the network.
export const SCOPE =
  "This is the browser's own record, read when you pressed the button. It lists the page itself and the files it asked for. It can include files the browser already had saved, and it keeps a limited number of entries, so it is not a count of everything sent. A size is the reply's size after the browser unpacked it.";

export type Entry = { name: string; decodedBodySize: number };
// Addresses on this site's own origin show as a path; any other shows whole. A browser gives another origin's reply size only
// when that origin allows it (Timing-Allow-Origin), and 0 then means not shown or empty.
export function describe(entries: Entry[], origin: string) {
  const own = entries.filter((e) => e.name.startsWith(`${origin}/`));
  const other = entries.filter((e) => !e.name.startsWith(`${origin}/`));
  const things = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
  const said = !entries.length
    ? "The browser's record for this page has nothing to list."
    : other.length
      ? `The browser's record for this page lists ${things(entries.length)}, the page itself included. ${other.length} came from another address, listed first below.`
      : `The browser's record for this page lists ${things(entries.length)}, the page itself included. ${own.length === 1 ? 'It' : 'Every one'} came from this site's own server.`;
  const line = (e: Entry, mine: boolean) => {
    const size = mine || e.decodedBodySize > 0 ? `${e.decodedBodySize} bytes` : 'size not shown by the browser, or empty';
    return `${mine ? e.name.slice(origin.length) : e.name}, ${size}`;
  };
  return { said, lines: [...other.map((e) => line(e, false)), ...own.map((e) => line(e, true))] };
}
