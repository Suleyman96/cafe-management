import { NextResponse } from 'next/server';

/**
 * Customer-web middleware.
 *
 * This app is intentionally unauthenticated (QR-code ordering flow).
 * All mutations proxy through staff-web API routes which handle auth,
 * rate limiting, and validation. Reads go through Supabase RLS.
 *
 * This middleware provides defense-in-depth security headers at the
 * edge level, supplementing the static headers in next.config.js.
 */
export function middleware() {
  const response = NextResponse.next();

  // Prevent the page from being embedded in iframes (clickjacking protection)
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
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest|.*\\.mp3$|.*\\.png$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
