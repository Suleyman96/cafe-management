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
  RateLimitError,
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

  // PL/pgSQL `RAISE EXCEPTION ... USING ERRCODE = 'no_data_found'`. RPCs use
  // this to signal "row not found" with a custom message (e.g.
  // `order_not_found_in_tenant`, `order_item not found`). Keep the message —
  // call sites use it for sentinel matching — and surface as a 404.
  //
  // Exception: the waiter-call acknowledge/resolve guard triggers
  // (migration 20260506000001) reuse the same ERRCODE for a *conflict*
  // semantic — two staff trying to claim the same buzz. Surface those as
  // ConflictError so the staff-web safe hook can render the localized
  // "already answered by X" toast instead of a generic "not found".
  if (err.code === 'P0002') {
    const sentinel = err.message?.trim();
    if (
      sentinel === 'waiter_call_already_acknowledged' ||
      sentinel === 'waiter_call_already_resolved' ||
      sentinel === 'order_close_requires_payment_or_reason'
    ) {
      return new ConflictError(sentinel);
    }
    return new NotFoundError(err.message || 'Resource');
  }

  // PostgreSQL: RLS or insufficient privilege
  if (err.code === '42501') {
    return new AuthorizationError(err.message || 'Insufficient privileges');
  }

  // PL/pgSQL `RAISE EXCEPTION ... USING ERRCODE = 'P0001'` (raise_exception).
  // Triggers use this for friendly-error sentinels — e.g. the table-cap
  // trigger raises `plan_required` so the user gets the localized
  // "upgrade your plan" message instead of the bare RLS rejection.
  // Map known plan sentinels to AuthorizationError so call sites'
  // sentinel matching + i18n keep working.
  if (err.code === 'P0001') {
    const sentinel = err.message?.trim();
    if (sentinel === 'plan_required') {
      return new AuthorizationError(sentinel);
    }
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
      sentinel === 'refund_tenant_mismatch' ||
      // Channel-policy enforcement on order_items (migration
      // 20260517000005). The takeout/delivery picker hides items
      // flagged not-takeoutable/not-deliverable; a bypass attempt
      // (raw SQL, malicious client, future API consumer) lands here.
      // Surface as ConflictError so the i18n layer maps to the
      // existing menu_item_not_* keys.
      sentinel === 'menu_item_not_takeoutable' ||
      sentinel === 'menu_item_not_deliverable'
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

function mapHttpStatus(
  status: number,
  message: string,
  details: Record<string, unknown> | undefined,
): AppError {
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
  if (status === 429) {
    return new RateLimitError('rate_limited');
  }
  if (status === 0 || status >= 500) {
    return new AppError(message, 'SERVER_ERROR', status || 500, details);
  }
  return new AppError(message, 'HTTP_ERROR', status, details);
}

/**
 * Map an HTTP response (typically from `/api/v1/*`) to a typed AppError.
 *
 * `body` is the parsed JSON body if available — by convention,
 * `{ error: string, details?: unknown, request_id?: string }`. Falls back to a
 * generic message when the body is not JSON or empty.
 *
 * When the body carries a `request_id` (the server-set correlation ID, ADD-9),
 * it is attached to the returned error's `details.request_id` for EVERY error
 * type — even subclasses whose constructors don't take `details` — since
 * `AppError.details` is a public, inherited field. Client telemetry
 * (mutation-cache `onError`) reads it back to tag the Sentry event with the
 * same ID the server already logged, closing the client↔server trace loop.
 */
export function httpStatusToAppError(
  status: number,
  body: { error?: string; details?: Record<string, unknown>; request_id?: string } | null,
  fallbackMessage = 'Request failed',
): AppError {
  const message = body?.error || fallbackMessage;
  const error = mapHttpStatus(status, message, body?.details);
  if (body?.request_id) {
    error.details = { ...error.details, request_id: body.request_id };
  }
  return error;
}
