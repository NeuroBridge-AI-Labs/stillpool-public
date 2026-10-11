import { describe, expect, it } from 'vitest';
import { built, check, LAYERS, named, ready, RULES } from './layer-explorer.ts';

describe('layer-explorer', () => {
  it('holds eight rules, each in a layer from 1 to 7, and every layer has a rule', () => {
    expect(RULES).toHaveLength(8);
    expect(new Set(RULES.map((r) => r.layer))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expect(LAYERS).toHaveLength(7);
  });
  it('says layer 1 cannot be made unbreakable by any prompt', () => {
    expect(RULES[0].reason).toContain('No prompt can make it truly unbreakable.');
  });
  it('is ready only when every rule has a layer', () => {
    expect(ready(['1', '2', '3', '4', '5', '6', '7', '1'])).toBe(true);
    expect(ready(['1', '2', '3', '4', '5', '6', '7'])).toBe(false);
    expect(ready(['1', '2', '3', '4', '5', '6', '7', ''])).toBe(false);
    expect(ready(['1', '2', '3', '4', '5', '6', '7', '8'])).toBe(false);
  });
  it('says what the reader chose beside each rule, and keeps no score', () => {
    const rows = check(['1', '1', '3', '4', '5', '7', '6', '7']);
    expect(rows.map((r) => r.yours)).toEqual(['You chose this layer.', 'You chose layer 1.', 'You chose this layer.', 'You chose this layer.', 'You chose this layer.', 'You chose layer 7.', 'You chose this layer.', 'You chose this layer.']);
    expect(Object.keys(rows[0]).sort()).toEqual(['layer', 'reason', 'rule', 'yours']);
  });
  it('builds the prompt layer by layer, in layer order, within the 180 word limit', () => {
    const text = built();
    const at = LAYERS.map((_, i) => text.indexOf(named(i + 1)));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(text).toContain('Answer in the language the student writes in.\nUnless the student asks otherwise');
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(180);
    expect(text.endsWith('never write their essays for them.')).toBe(true);
  });
});
