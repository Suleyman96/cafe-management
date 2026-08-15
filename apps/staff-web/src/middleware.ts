import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRequestId, REQUEST_ID_HEADER } from '@/lib/api/request-id';
import { buildCspHeader, CSP_NONCE_HEADER } from '@/lib/security/csp';
import { createMiddlewareClient } from '@/lib/supabase/server';

// `/c/` is the cafe-scoped login landing (/c/{slug}) + its sign-in server
// action — both must be reachable while signed out.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/c/'];

/**
 * Clone the inbound request headers and stamp the per-request CSP nonce onto
 * them. Both `x-nonce` (for app code that wants to read it) and the full
 * `Content-Security-Policy` go on the *request* headers — Next.js reads the CSP
 * from the request to extract the nonce and apply it to the inline scripts it
 * renders.
 */
function withNonceHeaders(request: NextRequest, nonce: string, csp: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(CSP_NONCE_HEADER, nonce);
  headers.set('Content-Security-Policy', csp);
  return headers;
}

const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL || 'http://localhost:3000'];

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }
  // Non-browser clients (mobile apps, server-to-server) don't send Origin headers
  // and are never subject to CORS. Omitting headers is correct — returning '*'
  // would unnecessarily widen the attack surface.
  if (!origin) {
    return {};
  }
  return {};
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle CORS preflight for API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Add CORS headers to API responses
  if (pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(origin);

    // ADD-9: per-request correlation ID. Honor an inbound x-request-id so an
    // upstream caller (mobile / customer-web / a proxy) keeps the chain; mint
    // one otherwise. We forward it to the route handler on the request (so
    // handleRouteError can tag logs + Sentry with it) and echo it on every
    // response (so the client can capture it for an error report).
    const requestId = getRequestId(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);
    const withCommonHeaders = (response: NextResponse) => {
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    };

    // Customer-facing endpoints are intentionally unauthenticated (QR code ordering).
    // Individual route handlers validate tenant/table relationships.
    // /api/v1/health is unauthenticated by design (Blocker 7) — uptime
    // monitors can't carry credentials, and the response carries only
    // booleans + the build SHA, no tenant data.
    const isPublicApi =
      pathname.startsWith('/api/v1/customer/') ||
      pathname === '/api/health' ||
      pathname === '/api/v1/health';
    if (isPublicApi) {
      return withCommonHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
    }

    // All other API routes require authentication at the middleware level.
    // Individual route handlers still enforce role-based access (verifyStaff/verifyAdmin).
    const { supabase, response } = createMiddlewareClient(request, requestHeaders);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          [REQUEST_ID_HEADER]: requestId,
          ...corsHeaders,
        },
      });
    }

    return withCommonHeaders(response);
  }

  // Per-request nonce-based CSP for HTML page responses. Minted once here
  // (after the JSON API branch, which doesn't execute scripts and needs no
  // nonce) and threaded onto the request headers so Next.js stamps it onto
  // every inline hydration <script>. Redirects below intentionally skip the
  // CSP: a 302 has no HTML body, and the followed GET re-enters this
  // middleware and gets its own nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce);

  // Public paths skip the auth gate but still need the CSP — the login /
  // password-reset pages hydrate a form (signInWithPassword) that would
  // silently break under a strict script-src without the nonce.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const publicResponse = NextResponse.next({
      request: { headers: withNonceHeaders(request, nonce, cspHeader) },
    });
    publicResponse.headers.set('Content-Security-Policy', cspHeader);
    return publicResponse;
  }

  const { supabase, response } = createMiddlewareClient(
    request,
    withNonceHeaders(request, nonce, cspHeader),
  );

  // Page-nav gate uses getSession() (local cookie read + JWT decode, with
  // an auto-refresh round-trip only when the token is near expiry) rather
  // than getUser() (always a network call to Supabase Auth). Distant
  // regions (e.g. Azerbaijan → Tokyo) were paying ~250ms per navigation
  // for the getUser() roundtrip even though the JWT claims we read below
  // already gate UI access. Authorization at the API boundary is still
  // network-verified: every /api/v1/* route runs verifyStaff (which calls
  // auth.getUser server-side), and direct supabase-js writes from the
  // browser are gated by RLS. So middleware here only decides whether
  // to render the staff shell — a deactivated user has up to jwt_expiry
  // (1h) of UI grace before their next token refresh kicks them out,
  // and can't perform any privileged action in the meantime.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  let isActiveStaff = false;
  try {
    const payloadSegment = session.access_token.split('.')[1];
    if (!payloadSegment) throw new Error('Invalid token format');
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString());
    isActiveStaff = payload.is_active_staff === true;
  } catch {
    // Invalid token format
  }

  if (!isActiveStaff) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'inactive');
    return NextResponse.redirect(loginUrl);
  }

  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest, audio files, fonts
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest|.*\\.mp3$|.*\\.png$|.*\\.svg$|.*\\.webp$|.*\\.ttf$|.*\\.woff2?$).*)',
  ],
};
