import type { Database } from '@gustri/database/types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Create a Supabase client for use in Next.js middleware.
 * Reads auth cookies from the request and writes refreshed cookies to the response.
 *
 * `requestHeaders`, when supplied, are forwarded to the downstream route
 * handler via `NextResponse.next({ request: { headers } })`. Middleware uses
 * this to inject the `x-request-id` correlation header (ADD-9) so handlers and
 * `handleRouteError` can read it back.
 */
export function createMiddlewareClient(request: NextRequest, requestHeaders?: Headers) {
  const nextArg = requestHeaders ? { request: { headers: requestHeaders } } : { request };
  let response = NextResponse.next(nextArg);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next(nextArg);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return { supabase, response };
}

/**
 * Create a Supabase client for use in Server Components.
 * Reads auth cookies from the request via next/headers.
 */
export function createServerComponentClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Components are read-only — cookie writes are no-ops
        },
      },
    },
  );
}

/**
 * Create a Supabase client for use in Server Actions and Route Handlers.
 *
 * Unlike `createServerComponentClient`, this writes cookies through
 * `next/headers` so a server-side `signInWithPassword()` / `signOut()` /
 * `refreshSession()` lands the resulting auth cookies on the response
 * before the action returns. The next navigation request carries them,
 * which closes the SSR cookie-sync race that bounces freshly-logged-in
 * users back to `/login` (see `app/login/actions.ts`).
 */
export function createServerActionClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
