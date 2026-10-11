// Lesson 1.3's tokeniser (brief, "What the tests must prove"): T1 to T4, each with its known-bad case. A check that
// cannot fail is not a check, so each known-bad case runs the same check and must throw.
import { readFileSync } from 'node:fs';
import { decode, encode } from 'gpt-tokenizer/encoding/o200k_base';
import { expect, test } from 'vitest';
import { type Piece, piece, split, spoken } from './tokenizer.ts';

const EN = 'While AI can generate outputs that resemble human interactions, AI itself is not human.';
const GA = 'Cé gur féidir le IS aschuir a chruthú atá cosúil le hidirghníomhaíochtaí daonna, ní duine é IS féin.';
const EMOJI = '🧑‍🎓';

// Pack section 4 (o200k_base, gpt-tokenizer 4.0.0, measured 03-10-26), copied from the pack, never from split().
type Row = [string, number[], string[]];
const PACK: Row[] = [
  ['cat', [8837], ['cat']],
  ['unbelievable', [373, 9880, 45794], ['un', 'bel', 'ievable']],
  ['strawberry', [302, 1618, 19772], ['st', 'raw', 'berry']],
  [
    EN,
    [13076, 20837, 665, 10419, 32725, 484, 97941, 5396, 30722, 11, 20837, 8807, 382, 625, 5396, 13],
    ['While', ' AI', ' can', ' generate', ' outputs', ' that', ' resemble', ' human', ' interactions', ',', ' AI', ' itself', ' is', ' not', ' human', '.'],
  ],
  [
    GA,
    [34, 377, 30466, 46261, 505, 5436, 472, 332, 11224, 261, 191756, 1042, 45125, 175641, 505, 312, 16259, 956, 7067, 111794, 171664, 1033, 16024, 11, 22340, 79616, 1212, 5436, 73853, 13],
    ['C', 'é', ' gur', ' féidir', ' le', ' IS', ' as', 'ch', 'uir', ' a', ' chruth', 'ú', ' atá', ' cosúil', ' le', ' h', 'idir', 'gh', 'ní', 'omha', 'íochtaí', ' da', 'onna', ',', ' ní', ' duine', ' é', ' IS', ' féin', '.'],
  ],
];

const t1 = (rows: Row[]) => {
  for (const [text, ids, pieces] of rows) expect(split(text), text).toEqual(ids.map((id, i) => ({ id, text: pieces[i] })));
};

test('T1 split() gives the pack\'s o200k_base IDs and pieces for the five items', () => t1(PACK));

// P6.6: the page's five items are T1's five strings, so T1 and T5 check the same text.
test('T1 the page reads the five items from data/interactive/token-splitter.json, and they are these five', () => {
  expect(JSON.parse(readFileSync('data/interactive/token-splitter.json', 'utf8'))).toEqual(PACK.map(([t]) => t));
});

// The brief's table "How a split is shown, and read by a screen reader", one row each.
test('spoken() says each kind of piece as the brief\'s table does', () => {
  expect([302, 20837, 13, 11, 4103, 2524].map((id) => spoken(piece(id)))).toEqual([
    ['', 'st'],
    ['space, then ', 'AI'],
    ['full stop', ''],
    ['comma', ''],
    ['part of a character', ''],
    ['an invisible joining character', ''],
  ]);
});

test('T1 known-bad: "strawberry" with 302 changed to 303 fails', () => {
  expect(() => t1(PACK.map(([t, ids, p]) => [t, t === 'strawberry' ? [303, ...ids.slice(1)] : ids, p]))).toThrow();
});

const t2 = (manifest: string, lock: string) => {
  expect(JSON.parse(manifest).dependencies['gpt-tokenizer']).toBe('4.0.0');
  expect(lock).toContain('"gpt-tokenizer": ["gpt-tokenizer@4.0.0",');
};

test('T2 package.json pins gpt-tokenizer at exactly 4.0.0, and the lockfile resolves 4.0.0', () => {
  t2(readFileSync('package.json', 'utf8'), readFileSync('bun.lock', 'utf8'));
});

test('T2 known-bad: a ^ range, or a lockfile at another version, fails', () => {
  const lock = readFileSync('bun.lock', 'utf8');
  expect(() => t2(JSON.stringify({ dependencies: { 'gpt-tokenizer': '^4.0.0' } }), lock)).toThrow();
  expect(() => t2(readFileSync('package.json', 'utf8'), lock.replace('gpt-tokenizer@4.0.0', 'gpt-tokenizer@4.0.1'))).toThrow();
});

// The one sentence: "the Irish sentence needed 14 more pieces" (EMMI, 27-09-26: say the difference, not the ratio).
const t3 = (en: number, ga: number) => expect(ga - en).toBe(14);

test('T3 the Irish sentence is exactly 14 pieces more than the English', () => t3(split(EN).length, split(GA).length));

test('T3 known-bad: the short pair (5 and 5), 31 against 16, and 35 against 20 (15 more) fail', () => {
  const [en, ga] = [split('AI is not human.').length, split('Ní duine é IS.').length];
  expect([en, ga]).toEqual([5, 5]);
  expect(() => t3(en, ga)).toThrow();
  expect(() => t3(16, 31)).toThrow();
  expect(() => t3(20, 35)).toThrow();
});

// The lesson's Simple line states the counts by hand (p6-5-review S1): bind them to split() on the lesson's two sentences.
const LESSON = readFileSync('content/how-ai-works/tokens/index.mdx', 'utf8');
const stated = (lesson: string) => {
  const [en, ga] = [split(EN).length, split(GA).length];
  expect(lesson).toContain(EN);
  expect(lesson).toContain(`is ${en} pieces in English`);
  expect(lesson).toContain(`is ${ga} pieces, ${ga - en} more`);
};

test('T3 the lesson states the counts split() gives: 16 pieces, 30 pieces, 14 more', () => stated(LESSON));

test('T3 known-bad: the lesson with "31 pieces, 15 more" fails', () => {
  expect(() => stated(LESSON.replace('30 pieces, 14 more', '31 pieces, 15 more'))).toThrow();
});

// Pack F12: each ID's own bytes, from OpenAI's reference file.
const PARTS: Record<number, number[]> = { 4103: [0xf0, 0x9f], 100: [0xa7], 239: [0x91], 71344: [0xf0, 0x9f, 0x8e], 241: [0x93] };

const t4 = (read: (id: number) => Piece) => {
  const ids = encode(EMOJI);
  expect(ids).toEqual([4103, 100, 239, 2524, 71344, 241]);
  for (const order of [ids, ids.toReversed()]) {
    const pieces = order.map(read);
    for (const p of pieces) {
      if (p.id === 2524) expect(p, 'the invisible joining character').toEqual({ id: 2524, text: '‍' });
      else expect(p, `part of a character, ${p.id}`).toEqual({ id: p.id, bytes: PARTS[p.id] });
    }
  }
};

test('T4 the piece reader: the student emoji is 5 parts of a character and 1 joining character, in either order', () => t4(piece));

test('T4 known-bad: a reader that calls decode([id]) ID after ID fails (it shows the first half of the emoji under 239)', () => {
  const byDecode = (id: number): Piece => {
    const text = decode([id]);
    return text === '' || text.includes('�') ? { id, bytes: [] } : { id, text };
  };
  expect(() => t4(byDecode)).toThrow();
});

test('T4 decode(encode(x)) gives back x for the five items and the emoji', () => {
  for (const x of [...PACK.map(([t]) => t), EMOJI]) expect(decode(encode(x))).toBe(x);
});

test('T4 a piece that is a byte order mark keeps it (p6-5-review N1)', () => {
  expect(piece(5574)).toEqual({ id: 5574, text: '\uFEFF' });
});

// The MIT duty (plan P6.5): gpt-tokenizer's copyright and permission notice ships in NOTICE, word for word.
test('NOTICE carries gpt-tokenizer\'s copyright and permission notice', () => {
  const licence = readFileSync('node_modules/gpt-tokenizer/LICENSE', 'utf8').replace(/^MIT License\s*/, '').trim();
  expect(readFileSync('NOTICE', 'utf8')).toContain(licence);
});

test('NOTICE, /licences.txt and /notices name the installed gpt-tokenizer version, and no other', () => {
  const { version } = JSON.parse(readFileSync('node_modules/gpt-tokenizer/package.json', 'utf8'));
  for (const file of ['NOTICE', 'public/licences.txt', 'src/pages/notices.astro']) {
    expect(new Set(readFileSync(file, 'utf8').match(/gpt-tokenizer \d+\.\d+\.\d+/g)), file).toEqual(new Set([`gpt-tokenizer ${version}`]));
  }
});
