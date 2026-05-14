import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];

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
      const response = NextResponse.next();
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    }

    // All other API routes require authentication at the middleware level.
    // Individual route handlers still enforce role-based access (verifyStaff/verifyAdmin).
    const { supabase, response } = createMiddlewareClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Skip public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

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
    const payload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
    );
    isActiveStaff = payload.is_active_staff === true;
  } catch {
    // Invalid token format
  }

  if (!isActiveStaff) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'inactive');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest, audio files
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest|.*\\.mp3$|.*\\.png$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
