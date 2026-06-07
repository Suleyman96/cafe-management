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

// Phone validation lives in @gustri/database so the Zod *input* schemas there
// (`schemas/inputs.ts`) can reuse it — `@gustri/core` depends on
// `@gustri/database`, not the other way round, so it can't live here without a
// dependency cycle. Re-exported so existing
// `import { isValidPhone } from '@gustri/core'` call sites are unchanged.
export { isValidPhone, MIN_PHONE_DIGITS, PHONE_SHAPE_REGEX } from '@gustri/database';
