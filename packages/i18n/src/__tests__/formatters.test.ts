import { describe, expect, it } from 'vitest';
import { numberToWords } from '../formatters';

describe('numberToWords', () => {
  it('renders whole-number English with cents fraction', () => {
    expect(numberToWords(200, 'en')).toBe('two hundred and 00/100');
  });

  it('renders compound English numbers under 100', () => {
    expect(numberToWords(45, 'en')).toBe('forty-five and 00/100');
  });

  it('handles thousands and remaining hundreds', () => {
    expect(numberToWords(1500, 'en')).toBe('one thousand five hundred and 00/100');
  });

  it('handles cents portion', () => {
    expect(numberToWords(99.5, 'en')).toBe('ninety-nine and 50/100');
  });

  it('handles zero', () => {
    expect(numberToWords(0, 'en')).toBe('zero and 00/100');
  });

  it('normalizes negative amounts to absolute value', () => {
    expect(numberToWords(-50, 'en')).toBe('fifty and 00/100');
  });

  it('falls back to a locale-aware numeric string for non-English locales', () => {
    // Don't assert exact whitespace — Intl.NumberFormat uses NBSP / locale
    // separators that vary by ICU version. Just verify it's NOT English
    // words and contains the digits.
    const out = numberToWords(200, 'tr');
    expect(out).not.toContain('hundred');
    expect(out).toMatch(/200/);
  });

  it('treats `en-US` and other regional English locales as English', () => {
    expect(numberToWords(7, 'en-US')).toBe('seven and 00/100');
    expect(numberToWords(7, 'EN-GB')).toBe('seven and 00/100');
  });
});
