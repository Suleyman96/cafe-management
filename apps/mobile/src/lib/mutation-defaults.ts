import { isAppError, NetworkError } from '@gustri/core';

/**
 * Decide whether a failed mutation should be retried.
 *
 * Only retry transient failures: network errors and server-side errors that
 * are likely to succeed on a second attempt. Validation, auth, conflict, and
 * not-found errors are deterministic — retrying them just delays the inevitable
 * snackbar and creates noise in Sentry.
 */
export function networkErrorIsRetryable(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (isAppError(err)) {
    return err.code === 'NETWORK_ERROR' || err.code === 'SERVER_ERROR';
  }
  return false;
}
