import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Customer-web middleware.
 *
 * This app is intentionally unauthenticated (QR-code ordering flow).
 * All mutations proxy through staff-web API routes which handle auth,
 * rate limiting, and validation. Reads go through Supabase RLS.
 *
 * Two responsibilities here:
 *
 * 1. **Per-request CSP nonce.** Next.js 14 app router emits inline
 *    `<script>` blocks for hydration data (`self.__next_f.push(...)`).
 *    A static `script-src 'self'` policy blocks them — that's what
 *    silently broke the customer flow: the menu page rendered the
 *    loading skeleton forever because client-side hydration never
 *    executed. We mint a fresh base64 nonce per request, expose it on
 *    `x-nonce` so Next.js stamps it onto every script it renders, and
 *    emit the CSP header with `'nonce-${nonce}' 'strict-dynamic'`.
 *
 * 2. **Defense-in-depth headers** that supplement the static ones in
 *    `next.config.js` (which still sets non-CSP headers like HSTS).
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // Staff-web origin where /api/v1/customer/* lives. Customer-web POSTs
  // to it for waiter calls, feedback, order placement, cancel, etc. (see
  // src/lib/api-routes.ts). When customer-web and staff-web live on
  // separate origins — which is the case in prod (different Vercel
  // projects) AND in local/CI (3000 vs 3001) — the connect-src below
  // must include this origin or the browser blocks every customer
  // mutation with a CSP violation. 'self' covers only the customer-web
  // origin and is not enough.
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const isDev = process.env.NODE_ENV === 'development';

  // `'strict-dynamic'` lets scripts loaded by trusted (nonce'd) scripts
  // also run, so we don't have to nonce every chunk Next.js emits.
  // `'unsafe-eval'` is dev-only — Webpack HMR needs it.
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${supabaseUrl} ${apiBaseUrl} wss://*.supabase.co https://*.sentry.io`,
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest, audio/image files
     *
     * Per Next.js CSP guide we'd normally also exclude prefetched
     * routes, but they need the nonce header too — so we keep them in.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest|.*\\.mp3$|.*\\.png$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
