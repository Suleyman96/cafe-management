import { isAppError } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';
import { jsonError } from './response';

/**
 * Sentinel-only fallback for legacy `new Error('<sentinel>')` throws
 * that haven't been migrated to `AppError` subclasses yet. New code
 * should throw the right `AppError` subclass — the `isAppError(err)`
 * branch below handles it cleanly. Once every throw is typed this
 * map can go away entirely.
 *
 * Earlier versions of this map substring-matched English error text
 * ("table limit reached", "order limit reached", "plan allows") to
 * compensate for SQL triggers raising English RAISE EXCEPTION
 * strings. After migration 20260515000002 those triggers raise the
 * `plan_required` sentinel (P0001) which `handleSupabaseError` maps
 * to `AuthorizationError('plan_required')`, so the substring fallback
 * is no longer needed for the plan-cap paths.
 */
const SAFE_ERRORS: Record<string, { message: string; status: number }> = {
  plan_required: { message: 'plan_required', status: 403 },
  payment_exceeds_remaining: { message: 'payment_exceeds_remaining', status: 409 },
};

/**
 * Handles errors in API routes by:
 * 1. Returning safe, generic messages to clients
 * 2. Reporting the real error to Sentry
 */
export function handleRouteError(err: unknown) {
  // Typed AppError subclasses (`AuthorizationError`, `ValidationError`, …)
  // carry their own status + a user-facing message. Honor them before the
  // legacy substring map below, which only exists for raw `new Error(...)`
  // strings thrown from older service code.
  if (isAppError(err)) {
    return jsonError(err.message, err.statusCode);
  }

  const raw = err instanceof Error ? err.message : String(err);

  for (const [pattern, response] of Object.entries(SAFE_ERRORS)) {
    if (raw.includes(pattern)) {
      return jsonError(response.message, response.status);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[handleRouteError]', err);
  }
  Sentry.captureException(err);
  return jsonError('An error occurred processing your request', 500);
}
