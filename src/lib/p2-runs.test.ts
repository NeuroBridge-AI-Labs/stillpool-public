import { describe, expect, it } from 'vitest';
import { recording } from '../lesson-schema.ts';
import { cut, marksOf, paragraphs, settingRows, turns, variantOf } from './p2-runs.ts';

const model = { id: 'm-a', name: 'Model A', host: 'Host' };
const base = { id: 'R-2.9', model, date: '2026-10-03', settings: { max_tokens: 10, temperature: "not set, so the model's default", 'system prompt': 'in each variant that has one' } };
const one = (label: string, maker: 'A' | 'B', extra = {}) => ({ label, maker, messages: [{ role: 'user' as const, content: `${label} sent` }], runs: [{ reply: `${label} ${maker} reply` }], ...extra });
const rec = recording.parse({ ...base, variants: [one('A', 'A'), one('B', 'A', { system: 'Be brief.' }), { ...one('T', 'A'), messages: [{ role: 'user', content: 'one' }, { role: 'user', content: 'two' }], runs: [{ reply: 'second', replies: ['first', 'second'] }] }] });

describe('p2-runs', () => {
  it('finds a variant by label and maker, and fails loudly when there is none', () => {
    expect(variantOf(rec, 'A', 'A').label).toBe('A');
    expect(() => variantOf(rec, 'A', 'B')).toThrow(/no variant A from maker B/);
  });
  it('pairs each message with the reply to it, for one turn or many', () => {
    expect(turns(rec.variants[0], rec.variants[0].runs[0])).toEqual([{ sent: 'A sent', reply: 'A A reply' }]);
    expect(turns(rec.variants[2], rec.variants[2].runs[0])).toEqual([{ sent: 'one', reply: 'first' }, { sent: 'two', reply: 'second' }]);
    expect(() => turns(rec.variants[2], { reply: 'x' })).toThrow(/1 replies for 2 messages/);
  });
  it('cuts a reply around the marked text, and leaves it whole when the text is absent', () => {
    expect(cut('I attached it today', ['attached it'])).toEqual([['I ', false], ['attached it', true], [' today', false]]);
    expect(cut('nothing here', ['attached'])).toEqual([['nothing here', false]]);
    expect(cut('plain')).toEqual([['plain', false]]);
  });
  it('cuts around every marked piece of one reply, in reading order, and skips an overlap', () => {
    expect(cut('one two three four', ['three', 'one'])).toEqual([['one', true], [' two ', false], ['three', true], [' four', false]]);
    expect(cut('abcdef', ['abc', 'bcd'])).toEqual([['abc', true], ['def', false]]);
    expect(cut('abc', [undefined, ''])).toEqual([['abc', false]]);
  });
  it('says the system prompt that was recorded, not the file-wide line', () => {
    const rows = (vs: typeof rec.variants) => Object.fromEntries(settingRows(rec, vs));
    expect(rows([rec.variants[0]])['Instructions from us behind the message']).toBe('none');
    expect(rows([rec.variants[1]])['Instructions from us behind the message']).toBe('"Be brief."');
    expect(rows([rec.variants[0], rec.variants[1]])['Instructions from us behind the message']).toBe('none, except where a run shows one');
    expect(rows([rec.variants[0]]).Temperature).toBe('not sent, and the value the service used was not recorded');
  });
  it('finds a run mark and splits a summary into paragraphs', () => {
    const said = { summary: 'One.\n\nTwo.\n', marks: [{ variant: 'A', maker: 'A' as const, run: 1, shows: true, note: 'n' }, { variant: 'A', maker: 'A' as const, run: 2, shows: false, note: 'm' }] };
    expect(marksOf(said, 'A', 'A', 1).map((m) => m.note)).toEqual(['n']);
    expect(marksOf(said, 'A', 'A', 2).map((m) => m.note)).toEqual(['m']);
    expect(marksOf(said, 'A', 'A', 3)).toEqual([]);
    expect(marksOf(said, 'A', 'B', 1)).toEqual([]);
    const twice = { ...said, marks: [...said.marks, { variant: 'A', maker: 'A' as const, run: 1, shows: true, note: 'again' }] };
    expect(marksOf(twice, 'A', 'A', 1).map((m) => m.note), 'two marks on one run').toEqual(['n', 'again']);
    expect(paragraphs(said)).toEqual(['One.', 'Two.']);
  });
});
