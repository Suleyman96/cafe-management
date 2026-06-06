import { describe, expect, it } from 'vitest';
import { toCsv } from '../csv';

// Plan 14 — minimal CSV writer used by the shift-reconciliation export.
// These cover the corners that bite spreadsheets: embedded commas, quotes,
// newlines, BOM-less rendering of the bare string (the BOM is only added
// in the browser download path).

describe('toCsv', () => {
  it('renders simple rows with CRLF line endings', () => {
    const csv = toCsv([
      ['a', 'b', 'c'],
      [1, 2, 3],
    ]);
    expect(csv).toBe('a,b,c\r\n1,2,3');
  });

  it('quotes cells that contain commas', () => {
    const csv = toCsv([['name'], ['Smith, John']]);
    expect(csv).toBe('name\r\n"Smith, John"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([['note'], ['She said "hi"']]);
    expect(csv).toBe('note\r\n"She said ""hi"""');
  });

  it('quotes cells containing newlines so the row stays atomic', () => {
    const csv = toCsv([['note'], ['line one\nline two']]);
    expect(csv).toBe('note\r\n"line one\nline two"');
  });

  it('serializes Date as ISO string', () => {
    const csv = toCsv([['ts'], [new Date('2026-05-06T09:30:00Z')]]);
    expect(csv).toBe('ts\r\n2026-05-06T09:30:00.000Z');
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsv([
      ['a', 'b', 'c'],
      ['x', null, undefined],
    ]);
    expect(csv).toBe('a,b,c\r\nx,,');
  });

  it('handles numbers without quoting', () => {
    const csv = toCsv([['n'], [3.14]]);
    expect(csv).toBe('n\r\n3.14');
  });

  describe('formula-injection guard', () => {
    // These payloads contain no comma/quote/newline, so they're prefixed with a
    // single quote but NOT RFC-quoted.
    it.each([
      '=1+1',
      '+1',
      '-cmd',
      '@SUM(A1)',
      '\tdanger',
    ])('prefixes a string cell starting with a formula trigger (%j)', (payload) => {
      expect(toCsv([['name'], [payload]])).toBe(`name\r\n'${payload}`);
    });

    it('neutralizes a classic command payload (no comma → prefix only)', () => {
      const csv = toCsv([['staff'], ["=cmd|'/c calc'!A1"]]);
      expect(csv).toBe(`staff\r\n'=cmd|'/c calc'!A1`);
    });

    it('prefixes AND RFC-quotes when the payload also contains a comma', () => {
      const csv = toCsv([['staff'], ['=cmd,calc']]);
      expect(csv).toBe(`staff\r\n"'=cmd,calc"`);
    });

    it('does NOT prefix a legitimate negative *number*', () => {
      const csv = toCsv([['amount'], [-5.5]]);
      expect(csv).toBe('amount\r\n-5.5');
    });

    it('leaves a normal string untouched', () => {
      const csv = toCsv([['name'], ['Jane Doe']]);
      expect(csv).toBe('name\r\nJane Doe');
    });
  });
});
