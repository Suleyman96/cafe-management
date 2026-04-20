import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { jsonError } from './response';

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the typed data on success or a NextResponse error on failure.
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
    console.warn('[Validation]', JSON.stringify(result.error.issues));
    return { data: null, error: jsonError('Validation failed') };
  }

  return { data: result.data, error: null };
}
