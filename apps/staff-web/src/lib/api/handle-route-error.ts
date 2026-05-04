import { isAppError } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';
import { jsonError } from './response';

/**
 * Known business errors that are safe to expose to clients.
 * Maps a substring match to a user-friendly message and HTTP status.
 */
const SAFE_ERRORS: Record<string, { message: string; status: number }> = {
  'plan allows': { message: 'Order limit reached for your plan', status: 403 },
  plan_required: { message: 'plan_required', status: 403 },
  'exceeds remaining': { message: 'Payment amount exceeds remaining balance', status: 422 },
  payment_exceeds_remaining: { message: 'payment_exceeds_remaining', status: 409 },
  'order limit reached': { message: 'Monthly order limit reached for your plan', status: 403 },
  'table limit reached': { message: 'Table limit reached for your plan', status: 403 },
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

  Sentry.captureException(err);
  return jsonError('An error occurred processing your request', 500);
}
