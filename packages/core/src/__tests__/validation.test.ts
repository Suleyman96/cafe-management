import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { validateOrThrow } from '../validation';

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
