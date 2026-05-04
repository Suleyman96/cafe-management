import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { jsonError } from './response';

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the typed data on success or a NextResponse error on failure.
 *
 * On validation failure the response body carries
 * `{ error: 'Validation failed', details: { fieldErrors, formErrors } }`
 * so clients can pick out specific problems — most importantly a missing
 * `client_request_id` (Blocker 1, pre-release audit). The shape mirrors
 * `z.flatten()` so existing test fixtures keep matching.
 */
export async function validateBody<T>(request: NextRequest, schema: ZodSchema<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { data: null, error: jsonError('Invalid JSON body') };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const flat = result.error.flatten();
    return {
      data: null,
      error: jsonError('Validation failed', 400, {
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      }),
    };
  }

  return { data: result.data, error: null };
}
