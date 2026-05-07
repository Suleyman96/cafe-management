import type { ZodError, ZodTypeAny, z } from 'zod';
import { ValidationError } from './errors';

export interface ValidationErrorDetails extends Record<string, unknown> {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

function flatten(error: ZodError): ValidationErrorDetails {
  const flat = error.flatten();
  return {
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
    formErrors: flat.formErrors,
  };
}

/**
 * Validate `data` against a Zod schema, returning the parsed value or throwing a ValidationError.
 *
 * The thrown ValidationError carries the field-level errors in `details`, so UI layers can render
 * per-field feedback without re-parsing.
 */
export function validateOrThrow<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  label = 'Invalid input',
): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new ValidationError(label, flatten(result.error));
}

// ── Phone-number validation ─────────────────────────────────────────────────
//
// Customer-facing flows (delivery landing form, customer-web → staff-web
// `/api/v1/customer/orders`) accept `+`, digits, spaces, dashes, and parens.
// Total length is bounded 7–20 chars by the character-set regex below, BUT
// that alone admits inputs like `+()()()()` — shape-valid, totally
// uncallable. The audit found this is what the prior single-regex check
// allowed; `isValidPhone` adds the digit-count step so client and server
// reject the same set of garbage submissions.

/** Allowed character set + total-length bounds for customer-facing phones. */
export const PHONE_SHAPE_REGEX = /^[+\d\s\-()]{7,20}$/;

/** Minimum number of actual digits a phone must contain to be callable. */
export const MIN_PHONE_DIGITS = 7;

/**
 * Returns `true` when `value` is a plausible phone number under the
 * shared customer-flow contract: shape-allowed characters, 7–20 total
 * length, and at least `MIN_PHONE_DIGITS` real digits. Use this from
 * both client-side form validation and the staff-web Zod schema so a
 * bypass-the-client attacker can't post `+()` and have it stick.
 */
export function isValidPhone(value: string): boolean {
  if (!PHONE_SHAPE_REGEX.test(value)) return false;
  const digitCount = value.match(/\d/g)?.length ?? 0;
  return digitCount >= MIN_PHONE_DIGITS;
}
