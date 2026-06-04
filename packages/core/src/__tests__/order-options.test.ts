import { describe, expect, it } from 'vitest';
import { formatSelectedOptions, parseSelectedOptions } from '../order-options';

const snapshot = [
  { option_id: 'o1', option_name: 'Size', value_id: 'v1', value_name: 'Large', price_delta: 2 },
  {
    option_id: 'o2',
    option_name: 'Extras',
    value_id: 'v2',
    value_name: 'Extra cheese',
    price_delta: 1.5,
  },
];

describe('parseSelectedOptions', () => {
  it('parses a valid snapshot array', () => {
    expect(parseSelectedOptions(snapshot)).toHaveLength(2);
    expect(parseSelectedOptions(snapshot)[0].value_name).toBe('Large');
  });

  it('returns [] for null / non-array / garbage', () => {
    expect(parseSelectedOptions(null)).toEqual([]);
    expect(parseSelectedOptions(undefined)).toEqual([]);
    expect(parseSelectedOptions('nope')).toEqual([]);
    expect(parseSelectedOptions({})).toEqual([]);
  });

  it('skips malformed entries (missing value_name)', () => {
    const mixed = [...snapshot, { option_id: 'x' }, null, 42];
    expect(parseSelectedOptions(mixed)).toHaveLength(2);
  });

  it('coerces price_delta to a number', () => {
    const result = parseSelectedOptions([
      { option_id: 'o', option_name: 'O', value_id: 'v', value_name: 'V', price_delta: '3' },
    ]);
    expect(result[0].price_delta).toBe(3);
  });
});

describe('formatSelectedOptions', () => {
  it('joins value names with commas', () => {
    expect(formatSelectedOptions(snapshot)).toBe('Large, Extra cheese');
  });

  it('returns empty string for no options', () => {
    expect(formatSelectedOptions(null)).toBe('');
  });
});
