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
  // Mobile apps don't send origin headers — allow requests without origin
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
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
    // Customer and mobile API routes don't need auth middleware
    // (routes handle their own auth via verifyStaff/verifyAdmin)
    const response = NextResponse.next();
    const corsHeaders = getCorsHeaders(origin);
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify user has an active staff record
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!staff) {
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
