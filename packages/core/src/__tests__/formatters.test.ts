import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhoneNumber,
  formatTime,
} from '../formatters';

describe('formatCurrency', () => {
  it('formats with default USD', () => {
    expect(formatCurrency(10)).toBe('$10.00');
  });

  it('formats with custom currency', () => {
    const result = formatCurrency(10, 'EUR');
    expect(result).toContain('10');
  });
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2024-06-15T12:00:00Z');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

describe('formatTime', () => {
  it('formats time from date', () => {
    const result = formatTime('2024-06-15T14:30:00Z');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    const result = formatDateTime('2024-06-15T14:30:00Z');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatPhoneNumber', () => {
  it('formats 10-digit number', () => {
    expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
  });

  it('returns original if not 10 digits', () => {
    expect(formatPhoneNumber('+994501234567')).toBe('+994501234567');
  });
});
