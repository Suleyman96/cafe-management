import { isAppError, NetworkError, ValidationError } from '@gustri/core';

/**
 * Decide whether a failed mutation should be retried.
 *
 * Only retry transient failures: network errors and server-side errors that
 * are likely to succeed on a second attempt. Validation, auth, conflict, and
 * not-found errors are deterministic — retrying them just delays the inevitable
 * snackbar and creates noise in Sentry.
 *
 * `ValidationError` is short-circuited explicitly even though the default
 * branch below already returns false: it's the error class most likely to
 * leak from a `mutationFn` (we still call `validateOrThrow` there as a
 * safety net) so making the no-retry intent visible at the top of the
 * predicate keeps the contract obvious to anyone tweaking this file.
 */
export function networkErrorIsRetryable(err: unknown): boolean {
  if (err instanceof ValidationError) return false;
  if (err instanceof NetworkError) return true;
  if (isAppError(err)) {
    if (err.code === 'VALIDATION_ERROR') return false;
    return err.code === 'NETWORK_ERROR' || err.code === 'SERVER_ERROR';
  }
  return false;
}
