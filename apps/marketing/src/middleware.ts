import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Marketing middleware — per-request CSP nonce (M8).
 *
 * We removed `'unsafe-inline'` from `script-src`. But Next.js 14 App Router
 * always emits inline `<script>` blocks for its runtime + RSC hydration data
 * (`self.__next_f.push(...)`), and our own JSON-LD (`<script
 * type="application/ld+json">`, see `src/lib/structured-data.tsx`) is inline
 * too. A static `script-src 'self'` would block all of them — the exact
 * failure that left customer-web's menu stuck on a loading skeleton.
 *
 * So we mint a fresh base64 nonce per request, expose it on the `x-nonce`
 * request header (Next.js reads the nonce out of the request's CSP header and
 * stamps it onto every script it renders; our JSON-LD reads `x-nonce`
 * directly), and emit `script-src 'self' 'nonce-…' 'strict-dynamic'`.
 * `'strict-dynamic'` lets scripts loaded by a trusted (nonce'd) script — the
 * Plausible loader injected via `next/script` — run without host allowlisting;
 * `https://plausible.io` stays listed as the CSP2 fallback for older browsers.
 *
 * Trade-off: reading the nonce in a server component (the JSON-LD helper) opts
 * routes into dynamic rendering. That's the documented cost of the Next.js
 * nonce approach and mirrors customer-web.
 *
 * The non-CSP security headers (HSTS, X-Frame-Options, …) stay static in
 * `next.config.js`; only CSP is per-request here so it can carry the nonce.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  // `'unsafe-eval'` is dev-only — Webpack HMR needs it; it is never emitted in
  // production.
  const cspHeader = [
    "default-src 'self'",
    // `https://challenges.cloudflare.com` is the Turnstile loader (H3 signup
    // CAPTCHA). Under `'strict-dynamic'` CSP3 browsers ignore the host and
    // trust it because the nonce'd app bundle injects it; the host stays listed
    // as the CSP2 fallback for older browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://plausible.io https://challenges.cloudflare.com${
      isDev ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // `*.sentry.io` covers the region-scoped ingest hosts the browser SDK
    // POSTs errors to; `*.supabase.co` covers the signup auth call;
    // `challenges.cloudflare.com` covers the Turnstile widget's verification.
    "connect-src 'self' https://plausible.io https://*.supabase.co https://*.sentry.io https://challenges.cloudflare.com",
    // The Turnstile challenge renders inside an iframe from this origin;
    // `frame-src` is NOT covered by `'strict-dynamic'`, so it must be listed.
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization,
     * which never carry inline scripts and shouldn't pay for a per-request
     * nonce.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$|.*\\.webp$|.*\\.ico$).*)',
  ],
};
