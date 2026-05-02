/**
 * Provider-specific error mapping.
 *
 * Translates Supabase / PostgREST error codes and HTTP status codes into the
 * provider-agnostic `AppError` hierarchy from `@gustri/core`. Lives here, not
 * in core, so that core stays free of Supabase knowledge — swapping the
 * database provider only touches this file.
 */

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  getErrorMessage,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '@gustri/core';

export function handleSupabaseError(error: unknown): AppError {
  if (error == null) {
    return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR', 500);
  }
  const err = error as { code?: string; status?: number; message?: string; details?: string };

  if (err.code === 'PGRST301') {
    return new AuthenticationError();
  }

  if (err.code === '23505') {
    return new ConflictError('Resource already exists');
  }

  if (err.code === '23503') {
    return new ValidationError('Referenced resource does not exist');
  }

  // PostgREST: .single() returned 0 or multiple rows
  if (err.code === 'PGRST116') {
    return new NotFoundError(err.details || 'Resource');
  }

  // PostgreSQL: RLS or insufficient privilege
  if (err.code === '42501') {
    return new AuthorizationError(err.message || 'Insufficient privileges');
  }

  // PostgreSQL: CHECK constraint violation. The validate_payment_amount /
  // validate_refund_amount triggers RAISE with ERRCODE = 'check_violation' and
  // a sentinel message (e.g. 'payment_exceeds_remaining'). Map those to a
  // ConflictError so callers get a stable, machine-readable code rather than a
  // generic ValidationError.
  if (err.code === '23514') {
    const sentinel = err.message?.trim();
    if (
      sentinel === 'payment_exceeds_remaining' ||
      sentinel === 'refund_exceeds_available' ||
      sentinel === 'payment_tenant_mismatch' ||
      sentinel === 'refund_tenant_mismatch'
    ) {
      return new ConflictError(sentinel);
    }
    return new ValidationError(err.message || 'Value violates constraint');
  }

  if (err.status === 404) {
    return new NotFoundError('Resource');
  }

  if (err.status === 401) {
    return new AuthenticationError();
  }

  if (err.status === 403) {
    return new AuthorizationError();
  }

  if (err.code === 'NETWORK_ERROR') {
    return new NetworkError();
  }

  return new AppError(getErrorMessage(error), err.code || 'UNKNOWN_ERROR', err.status || 500);
}

/**
 * Map an HTTP response (typically from `/api/v1/*`) to a typed AppError.
 *
 * `body` is the parsed JSON body if available — by convention,
 * `{ error: string, details?: unknown }`. Falls back to a generic message
 * when the body is not JSON or empty.
 */
export function httpStatusToAppError(
  status: number,
  body: { error?: string; details?: Record<string, unknown> } | null,
  fallbackMessage = 'Request failed',
): AppError {
  const message = body?.error || fallbackMessage;
  const details = body?.details;

  if (status === 400 || status === 422) {
    return new ValidationError(message, details);
  }
  if (status === 401) {
    return new AuthenticationError(message);
  }
  if (status === 403) {
    return new AuthorizationError(message);
  }
  if (status === 404) {
    return new NotFoundError(message);
  }
  if (status === 409) {
    return new ConflictError(message);
  }
  if (status === 0 || status >= 500) {
    return new AppError(message, 'SERVER_ERROR', status || 500, details);
  }
  return new AppError(message, 'HTTP_ERROR', status, details);
}
