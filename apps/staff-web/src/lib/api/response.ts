import { NextResponse } from 'next/server';

/**
 * Standardized API response helpers.
 * Keeps route handlers concise and consistent.
 */

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Generic error response. Pass `details` to surface structured field-level
 * errors (e.g. Zod's flattened fieldErrors) so clients can detect specific
 * conditions like a missing `client_request_id`.
 */
export function jsonError(message: string, status = 400, details?: Record<string, unknown>) {
  return NextResponse.json(details ? { error: message, details } : { error: message }, { status });
}

export function jsonRateLimited(resetAt: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
    },
  );
}
