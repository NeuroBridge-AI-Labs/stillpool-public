import { describe as suite, expect, it } from 'vitest';
import { CHAT, COUNT_NOTE, describe, PLACES, SCOPE } from './what-leaves-your-device.ts';

const own = (path: string, size = 10) => ({ name: `https://example.test${path}`, decodedBodySize: size });

suite('describe: the live list in words', () => {
  it('says every entry came from this site when none left it, and counts the page itself', () => {
    const r = describe([own('/page/', 99), own('/a.css'), own('/b.js', 5)], 'https://example.test');
    expect(r.said).toBe("The browser's record for this page lists 3 entries, the page itself included. Every one came from this site's own server.");
    expect(r.lines).toEqual(['/page/, 99 bytes', '/a.css, 10 bytes', '/b.js, 5 bytes']);
  });
  it('says "It" for one entry, and says nothing to list for none', () => {
    expect(describe([own('/a.css')], 'https://example.test').said).toBe("The browser's record for this page lists 1 entry, the page itself included. It came from this site's own server.");
    expect(describe([], 'https://example.test').said).toBe("The browser's record for this page has nothing to list.");
  });
  it('lists an entry from another address first, whole, and says so', () => {
    const r = describe([own('/a.css'), { name: 'https://other.test/x.js', decodedBodySize: 0 }], 'https://example.test');
    expect(r.said).toBe("The browser's record for this page lists 2 entries, the page itself included. 1 came from another address, listed first below.");
    expect(r.lines).toEqual(['https://other.test/x.js, size not shown by the browser, or empty', '/a.css, 10 bytes']);
  });
  it('shows the size of another address when the browser gives one (Timing-Allow-Origin)', () => {
    expect(describe([{ name: 'https://other.test/x.js', decodedBodySize: 123 }], 'https://example.test').lines).toEqual(['https://other.test/x.js, 123 bytes']);
  });
  it('does not take an address that only starts like this site for this site', () => {
    expect(describe([{ name: 'https://example.test.evil.test/x', decodedBodySize: 0 }], 'https://example.test').said).toContain('another address');
  });
});

suite('the toy follows its own rules', () => {
  it('holds one line in memory, the one the user asked to be remembered', () => {
    expect(PLACES[1].text).toContain(CHAT[2]);
    expect(PLACES.map((p) => p.holds)).toEqual([0, 1, 2]);
  });
});

suite('what it says about the count and the list', () => {
  it('does not promise a number of requests for a finish page, and names the script and the message apart', () => {
    expect(COUNT_NOTE).not.toMatch(/\bone more request\b|\btwo\b|\d/);
    expect(COUNT_NOTE).toContain('counting script');
    expect(COUNT_NOTE).toContain('one anonymous page-view message');
  });
  it('says the list is a snapshot of the browser record, that saved files can be in it, and what a size is', () => {
    for (const w of ['browser\'s own record', 'already had saved', 'limited number of entries', 'not a count of everything sent', 'after the browser unpacked it']) expect(SCOPE).toContain(w);
  });
});
