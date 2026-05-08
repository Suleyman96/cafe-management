/**
 * H10: sanitize a URL string for inclusion in a Sentry breadcrumb.
 *
 * Sentry breadcrumbs from `fetch`/`xhr` carry the request URL verbatim. In
 * production we have to assume any query string can hold something we don't
 * want exfiltrated to Sentry — customer phone numbers passed as search terms,
 * order ids the support team can use to pivot on a real user, sentinel
 * `?error=...` strings the server may have stuffed with free text. The
 * audit's earlier per-param denylist (`searchParams.delete('token'); …`) was
 * fragile because it required listing every possible secret-y name; this
 * helper drops the entire query string up front so we don't need to know
 * the names.
 *
 * Returns the cleaned URL string, or `null` if the result still doesn't
 * parse as a URL — that signals the caller (the `beforeSend` filter) to
 * drop the entire breadcrumb rather than ship a string we can't reason
 * about.
 */
export function sanitizeBreadcrumbUrl(rawUrl: string): string | null {
  const stripped = rawUrl.replace(/\?.*$/, '');
  try {
    new URL(stripped);
    return stripped;
  } catch {
    return null;
  }
}
