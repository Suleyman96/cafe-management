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
    const message = result.error.issues.map((i) => i.message).join('; ');
    return { data: null, error: jsonError(message) };
  }

  return { data: result.data, error: null };
}
