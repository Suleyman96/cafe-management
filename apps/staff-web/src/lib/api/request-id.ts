/**
 * Per-request correlation ID (ADD-9 structured logging).
 *
 * This is the server-generated request-correlation ID. It is DISTINCT from
 * `client_request_id` — the client-supplied idempotency key carried in some
 * mutation bodies (orders/payments/refunds/...). That one dedupes retries;
 * this one ties a single HTTP request to its log lines + Sentry event so a
 * client error report can be traced to the exact server-side execution.
 *
 * Flow: middleware reads an inbound `x-request-id` (so an upstream caller —
 * mobile, customer-web, a proxy — can supply its own and keep the chain) or
 * mints a fresh UUID, forwards it to the route handler on the request, and
 * echoes it on the response. Handlers/`handleRouteError` read it back via
 * `getRequestId(request)`.
 */

export const REQUEST_ID_HEADER = 'x-request-id';

/** Mint a new correlation ID. `crypto.randomUUID` exists in both the Edge
 *  (middleware) and Node (route handler) runtimes Next.js uses. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Read the correlation ID for the current request. Returns the inbound
 * `x-request-id` header (set by middleware, or supplied by an upstream
 * caller) when present, otherwise mints a fresh one so a handler invoked
 * outside the middleware path still gets a usable ID.
 */
export function getRequestId(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get(REQUEST_ID_HEADER) || newRequestId();
}
