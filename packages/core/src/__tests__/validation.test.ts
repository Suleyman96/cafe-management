import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { isValidPhone, MIN_PHONE_DIGITS, validateOrThrow } from '../validation';

const schema = z.object({
  name: z.string().min(1, 'name required'),
  age: z.number().int().nonnegative(),
});

describe('validateOrThrow', () => {
  it('returns parsed data when valid', () => {
    const result = validateOrThrow(schema, { name: 'Ann', age: 30 });
    expect(result).toEqual({ name: 'Ann', age: 30 });
  });

  it('throws ValidationError with field-level details', () => {
    expect.hasAssertions();
    try {
      validateOrThrow(schema, { name: '', age: -1 }, 'Invalid form');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const details = (err as ValidationError).details as
        | { fieldErrors: Record<string, string[]>; formErrors: string[] }
        | undefined;
      expect(details?.fieldErrors.name?.[0]).toBe('name required');
      expect(details?.fieldErrors.age?.length).toBeGreaterThan(0);
      expect((err as ValidationError).message).toBe('Invalid form');
    }
  });

  it('uses default label when none provided', () => {
    try {
      validateOrThrow(schema, { name: '', age: 0 });
    } catch (err) {
      expect((err as ValidationError).message).toBe('Invalid input');
    }
  });

  it('strips unknown keys per Zod default behavior', () => {
    const result = validateOrThrow(schema, { name: 'Ann', age: 30, extra: 'x' });
    expect(result).toEqual({ name: 'Ann', age: 30 });
  });
});

describe('isValidPhone', () => {
  // Audit-driven contract: the customer-flow phone field must reject inputs
  // the prior single-regex `/^[+\d\s\-()]{7,20}$/` admitted as shape-valid
  // but uncallable. Every entry below is a real failure mode an attacker
  // (or a typo) could submit through the delivery landing form or directly
  // against the staff-web `/api/v1/customer/orders` route's Zod schema.

  describe('rejects shape-valid garbage with too few digits', () => {
    it.each([
      ['all parens (zero digits)', '+()()()()'],
      ['parens + spaces (zero digits)', '+( ) ( )'],
      ['only one digit padded', '+1     '],
      ['hyphens only', '-------'],
      ['signs and parens, no digits', '+()()()-'],
      [
        `${MIN_PHONE_DIGITS - 1} digits is one short`,
        '1'.repeat(MIN_PHONE_DIGITS - 1).padEnd(7, ' '),
      ],
    ])('%s', (_label, value) => {
      expect(isValidPhone(value)).toBe(false);
    });
  });

  describe('rejects out-of-shape inputs (character set / length bounds)', () => {
    it.each([
      ['empty string', ''],
      ['too short (< 7 chars)', '+1234'],
      ['too long (> 20 chars)', `+${'1'.repeat(20)}`],
      ['letters', '+1abc-555-1234'],
      ['emoji', '+1234567 📞'],
      ['unicode digits (NOT ASCII)', '+ １２３４５６７'],
    ])('%s', (_label, value) => {
      expect(isValidPhone(value)).toBe(false);
    });
  });

  describe('accepts realistic phone shapes', () => {
    it.each([
      ['E.164 international', '+15551234567'],
      ['international with spaces', '+1 555 123 4567'],
      ['parens and dashes', '(555) 123-4567'],
      ['plain digits at min length', '1234567'],
      ['leading plus, trailing slack', '+1 555-1234'],
    ])('%s', (_label, value) => {
      expect(isValidPhone(value)).toBe(true);
    });
  });
});
