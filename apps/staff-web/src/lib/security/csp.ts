/**
 * Content-Security-Policy construction for staff-web.
 *
 * Ported from customer-web's middleware (the proven pattern): a fresh base64
 * nonce per request, threaded onto the request headers so Next.js 14's App
 * Router stamps it onto every inline hydration `<script>` it emits
 * (`self.__next_f.push(...)`, the chunk loaders, the runtime). A static
 * `script-src 'self'` blocks those and hydration silently fails — the page
 * renders but `onSubmit` handlers never attach, so forms fall back to native
 * submission. The nonce + `'strict-dynamic'` lets us drop the `'unsafe-inline'`
 * / `'unsafe-eval'` the old static `next.config.js` policy required.
 */

/** Request/response header carrying the per-request nonce for app code to read. */
export const CSP_NONCE_HEADER = 'x-nonce';

/**
 * Build the CSP header value for a given per-request `nonce`.
 *
 * - `'strict-dynamic'` lets scripts loaded by a trusted (nonce'd) script run
 *   too, so we don't have to nonce every chunk Next.js emits.
 * - `'unsafe-eval'` is dev-only — Webpack HMR / React Fast Refresh need it.
 * - `connect-src` must include the Supabase origin (REST + realtime websocket)
 *   and Sentry; empty origins are filtered so an unset env var can't emit a
 *   malformed directive with stray whitespace.
 * - `style-src 'unsafe-inline'` is kept: Tailwind ships a stylesheet but React
 *   inline `style={}` attributes and a few libraries still need it, and styles
 *   are not a script-execution vector.
 */
export function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const connectSrc = [
    "'self'",
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    'wss://*.supabase.co',
    'https://*.sentry.io',
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
