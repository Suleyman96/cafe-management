import { isAppError } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { logger } from './logger';
import { REQUEST_ID_HEADER } from './request-id';

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

/** Minimal shape we read off the incoming request — satisfied by both
 *  `NextRequest` and the Web `Request`. */
interface RequestLike {
  headers: { get(name: string): string | null };
  method?: string;
  url?: string;
}

/** Best-effort route path from the request URL, for log/Sentry grouping. */
function routeOf(request?: RequestLike): string | undefined {
  if (!request?.url) return undefined;
  try {
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

/**
 * Handles errors in API routes by:
 * 1. Returning safe, generic messages to clients
 * 2. Reporting the real error to Sentry (with the request-correlation ID)
 * 3. Emitting a structured log line tagged with the same `request_id`
 *
 * Pass the incoming `request` to enable correlation:
 * `handleRouteError(err, request)`. The `request_id` is read from the
 * `x-request-id` header that middleware sets on every `/api/*` request (the
 * single source of truth — we deliberately do NOT mint a fresh ID here, which
 * would not match any middleware-set/logged ID). It is echoed both in the JSON
 * body (CORS-proof — a cross-origin caller like customer-web can always read
 * the body) and the `x-request-id` response header. Backward compatible —
 * `request` is optional and a request without the header simply yields a safe
 * response with no correlation ID.
 */
export function handleRouteError(err: unknown, request?: RequestLike) {
  const requestId = request?.headers.get(REQUEST_ID_HEADER) || undefined;
  const route = routeOf(request);
  const method = request?.method;

  const errorResponse = (message: string, status: number, details?: Record<string, unknown>) => {
    const body: Record<string, unknown> = { error: message };
    if (details) body.details = details;
    if (requestId) body.request_id = requestId;
    const res = NextResponse.json(body, { status });
    if (requestId) res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  };

  // Typed AppError subclasses (`AuthorizationError`, `ValidationError`, …)
  // carry their own status + a user-facing message. These are expected
  // business outcomes, not server faults — log at `warn`, don't page Sentry.
  if (isAppError(err)) {
    logger.warn('route_app_error', {
      request_id: requestId,
      route,
      method,
      status: err.statusCode,
      error: err.message,
    });
    return errorResponse(err.message, err.statusCode);
  }

  const raw = err instanceof Error ? err.message : String(err);

  for (const [pattern, response] of Object.entries(SAFE_ERRORS)) {
    if (raw.includes(pattern)) {
      logger.warn('route_safe_error', {
        request_id: requestId,
        route,
        method,
        status: response.status,
        error: response.message,
      });
      return errorResponse(response.message, response.status);
    }
  }

  // Unexpected — a real server fault. Structured error log + Sentry, both
  // tagged with the correlation ID so a client error report ties to the
  // exact Sentry event and log line.
  logger.error('route_unhandled_error', {
    request_id: requestId,
    route,
    method,
    status: 500,
    error: raw,
  });
  if (process.env.NODE_ENV !== 'production') {
    console.error('[handleRouteError]', err);
  }
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag('request_id', requestId);
    if (route) scope.setTag('route', route);
    Sentry.captureException(err);
  });
  return errorResponse('An error occurred processing your request', 500);
}
