/**
 * URL scrubbing helpers for Sentry browser events.
 *
 * Customer-web reaches the app via QR-coded URLs that carry a bearer
 * `qr_token` in the fragment (`#token=…`) or, on legacy paths, the query
 * string (`?token=…`). The token is treated as sensitive — anyone holding
 * it can derive a tenant and place orders against it. We never want it
 * landing in Sentry's UI as part of a navigation breadcrumb or
 * exception URL, so the `instrumentation-client.ts` `beforeSend` /
 * `beforeBreadcrumb` hooks pipe URLs through this helper.
 *
 * Pure-string transformation, no Sentry SDK imports — keeps the unit
 * test cheap and the helper reusable from any non-Sentry surface that
 * also wants to log a scrubbed URL.
 */

/**
 * Names of bearer-credential query/fragment params we redact. Add a new
 * entry here AND in any callsite-specific allowlist; missing the entry
 * means the param value will reach Sentry verbatim.
 */
export const TOKEN_PARAM_NAMES = ['token', 'access_token', 'qr_token'] as const;

const REDACTED = '[REDACTED]';

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
 * Loose shape that matches the relevant Sentry event slices we need to
 * scrub. Avoids importing `@sentry/types` here so the unit test can run
 * without the full SDK in scope; the production caller passes in a real
 * `ErrorEvent` and the structural match is sufficient.
 */
type ScrubbableSentryEvent = {
  request?: { url?: string } & Record<string, unknown>;
  breadcrumbs?: Array<
    {
      data?: { url?: string } & Record<string, unknown>;
    } & Record<string, unknown>
  >;
} & Record<string, unknown>;

/**
 * `beforeSend` hook for `Sentry.init`. Mutates a copy of the event so
 * the SDK's downstream serialization sees scrubbed URLs but the caller
 * doesn't observe in-place mutation.
 */
export function scrubSentryEvent<E extends ScrubbableSentryEvent>(event: E): E {
  const next: ScrubbableSentryEvent = { ...event };

  if (typeof next.request?.url === 'string') {
    next.request = { ...next.request, url: scrubTokenFromUrl(next.request.url) };
  }

  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((crumb) => {
      if (typeof crumb?.data?.url === 'string') {
        return {
          ...crumb,
          data: { ...crumb.data, url: scrubTokenFromUrl(crumb.data.url) },
        };
      }
      return crumb;
    });
  }

  return next as E;
}
