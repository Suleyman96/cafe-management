import { describe, expect, it } from 'vitest';
import {
  isNonEmptyString,
  isPositiveNumber,
  isValidEmail,
  isValidPhoneNumber,
  isValidUUID,
} from '../validators';

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(isValidEmail('testexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(isValidEmail('test@')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(isValidEmail('test @example.com')).toBe(false);
  });
});

describe('isValidPhoneNumber', () => {
  it('accepts valid phone number', () => {
    expect(isValidPhoneNumber('+1234567890')).toBe(true);
  });

  it('accepts formatted phone number', () => {
    expect(isValidPhoneNumber('(123) 456-7890')).toBe(true);
  });

  it('rejects too short number', () => {
    expect(isValidPhoneNumber('12345')).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(isValidPhoneNumber('abcdefghij')).toBe(false);
  });
});

describe('isValidUUID', () => {
  it('accepts valid UUID', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('accepts positive number', () => {
    expect(isPositiveNumber(5)).toBe(true);
  });

  it('rejects zero', () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it('rejects negative number', () => {
    expect(isPositiveNumber(-1)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isPositiveNumber(Number.NaN)).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('accepts non-empty string', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(isNonEmptyString('   ')).toBe(false);
  });
});
