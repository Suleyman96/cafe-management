/**
 * URL + PII scrubbing helpers for Sentry browser events.
 *
 * Customer-web reaches the app via QR-coded URLs that carry a bearer
 * `qr_token` in the fragment (`#token=…`) or, on legacy paths, the query
 * string (`?token=…`). The token is treated as sensitive — anyone holding
 * it can derive a tenant and place orders against it. Mutation request
 * bodies for `/api/v1/customer/orders` (delivery) additionally carry
 * the customer's name, phone, and address. Neither URL nor body should
 * reach Sentry verbatim, so the `instrumentation-client.ts` `beforeSend`
 * / `beforeBreadcrumb` hooks pipe events through this helper (S5).
 *
 * Pure-string + JSON transformation, no Sentry SDK imports — keeps the
 * unit test cheap and the helper reusable from any non-Sentry surface
 * that also wants to log a scrubbed URL or object.
 */

/**
 * Names of bearer-credential query/fragment params we redact. Add a new
 * entry here AND in any callsite-specific allowlist; missing the entry
 * means the param value will reach Sentry verbatim.
 */
export const TOKEN_PARAM_NAMES = ['token', 'access_token', 'qr_token'] as const;

/**
 * Names of PII fields we redact when they appear as object keys anywhere
 * in an event (request body, contexts, extras, breadcrumb data, …).
 *
 * Covers the mutation bodies for `/api/v1/customer/orders` (delivery)
 * and `/api/v1/customer/waiter-calls` (which carries customer notes).
 * `client_request_id` is low-risk on its own but it's identifying when
 * paired with order metadata, so we strip it too.
 *
 * Matched case-insensitively against keys; exact match only (no
 * substring) so unrelated fields like `customer_id` are left alone.
 */
export const PII_FIELD_NAMES = [
  'customer_phone',
  'customer_name',
  'delivery_address',
  'delivery_phone',
  'delivery_customer_name',
  'delivery_notes',
  'customer_notes',
  'internal_notes',
  'notes',
  'qr_token',
  'access_token',
  'delivery_access_token',
  'token',
  'client_request_id',
] as const;

const PII_FIELD_SET: Set<string> = new Set(PII_FIELD_NAMES.map((s) => s.toLowerCase()));

const REDACTED = '[REDACTED]';

/**
 * Maximum recursion depth when walking nested event objects. Sentry
 * events are usually shallow; the cap is a defensive guard against a
 * pathological circular structure that would otherwise stack-overflow
 * inside the SDK's `beforeSend` handler.
 */
const MAX_SCRUB_DEPTH = 8;

/**
 * Replace any of the known bearer-credential param values in `url` with
 * `[REDACTED]`. Handles both `?key=…` (query string) and `#key=…`
 * (URL fragment) forms — the customer-web token capture moved to the
 * fragment in plan 17 M1, but old shared links may still carry the
 * query form, and Sentry breadcrumbs surface both.
 *
 * Returns the input unchanged when there's nothing to scrub. Never
 * throws on malformed URLs — Sentry hooks must not raise inside their
 * own handlers or the SDK silently swallows the original event.
 */
export function scrubTokenFromUrl(url: string): string {
  if (!url) return url;

  let result = url;
  for (const param of TOKEN_PARAM_NAMES) {
    // Query form: `?token=…` or `&token=…`, value bounded by `&` or `#`.
    const queryRe = new RegExp(`([?&])${param}=[^&#]*`, 'g');
    result = result.replace(queryRe, `$1${param}=${REDACTED}`);

    // Fragment form: `#token=…`, value bounded by `&` (multiple fragment
    // params separated by `&` is non-standard but appears in some
    // OAuth-style flows we didn't write but might see in breadcrumbs).
    const fragmentRe = new RegExp(`#${param}=[^&]*`, 'g');
    result = result.replace(fragmentRe, `#${param}=${REDACTED}`);
  }
  return result;
}

/**
 * Recursively walk `value` and redact any object property whose key
 * matches `PII_FIELD_NAMES` (case-insensitive). Returns a new value;
 * the input is not mutated. Strings/numbers/booleans/null are returned
 * as-is. Arrays are mapped element-wise. Objects beyond `MAX_SCRUB_DEPTH`
 * are returned unchanged as a circular/runaway guard.
 *
 * Exported for unit testing; the production entry point is
 * `scrubSentryEvent`.
 */
export function scrubPiiFields<T>(value: T, depth = 0): T {
  if (depth > MAX_SCRUB_DEPTH) return value;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubPiiFields(v, depth + 1)) as unknown as T;
  }
  if (typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (PII_FIELD_SET.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else {
      out[key] = scrubPiiFields(val, depth + 1);
    }
  }
  return out as unknown as T;
}

/**
 * `beforeSend` hook for `Sentry.init`. Accepts any object-shaped event
 * (the helper does runtime structural checks; the loose type signature
 * keeps Sentry's narrower `ErrorEvent` assignable without coupling to
 * `@sentry/types`). Returns a shallow copy with scrubbed values so the
 * SDK's downstream serialization sees the redactions but the caller
 * doesn't observe in-place mutation.
 *
 * Covers (S5):
 *   - `request.url` and `breadcrumb.data.url` — bearer tokens in query
 *     or fragment params.
 *   - `request.data` — JSON bodies posted to `/api/v1/customer/*` that
 *     carry delivery PII.
 *   - `contexts`, `extra`, `tags` — any custom payload attached at the
 *     capture site (audit shows no current callers add PII here, but
 *     the scrub is defensive against future additions).
 *   - `breadcrumb.data` — fetch breadcrumbs may attach response/request
 *     metadata that includes PII keys.
 */
export function scrubSentryEvent<E>(event: E): E {
  if (event == null || typeof event !== 'object') return event;
  const src = event as unknown as Record<string, unknown>;
  const next: Record<string, unknown> = { ...src };

  const req = next.request as Record<string, unknown> | undefined;
  if (req && typeof req === 'object') {
    const reqCopy: Record<string, unknown> = { ...req };
    if (typeof reqCopy.url === 'string') {
      reqCopy.url = scrubTokenFromUrl(reqCopy.url);
    }
    if (reqCopy.data !== undefined) {
      reqCopy.data = scrubPiiFields(reqCopy.data);
    }
    next.request = reqCopy;
  }

  if (next.contexts) next.contexts = scrubPiiFields(next.contexts);
  if (next.extra) next.extra = scrubPiiFields(next.extra);
  if (next.tags) next.tags = scrubPiiFields(next.tags);

  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = (next.breadcrumbs as Array<Record<string, unknown>>).map((crumb) => {
      const crumbData = crumb?.data as Record<string, unknown> | undefined;
      if (!crumbData) return crumb;
      const data: Record<string, unknown> = { ...crumbData };
      if (typeof data.url === 'string') {
        data.url = scrubTokenFromUrl(data.url);
      }
      return { ...crumb, data: scrubPiiFields(data) };
    });
  }

  return next as unknown as E;
}
