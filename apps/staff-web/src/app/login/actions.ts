'use server';

import { createSupabaseWrapper } from '@gustri/api-client';
import * as Sentry from '@sentry/nextjs';
import { createServerActionClient } from '@/lib/supabase/server';

export type SignInErrorCode = 'invalid_credentials' | 'no_active_staff' | 'unexpected';

export type SignInActionResult = { ok: true } | { ok: false; error: SignInErrorCode };

/**
 * Server-side sign-in.
 *
 * Performs `signInWithPassword` through a Server-Action Supabase client so
 * the resulting session cookies are flushed to the response before the
 * action returns. The browser commits `Set-Cookie` headers before any JS
 * that awaited the call continues, so the client's follow-up
 * `router.push('/')` request carries the session — the middleware's
 * `getSession()` check passes on the first try.
 *
 * Doing this client-side raced: `signInWithPassword` resolves on the
 * client, `router.push('/')` fires on the same tick, the navigation
 * request can leave the browser before the SSR cookie writes commit, and
 * middleware bounces the user back to `/login` until cookies catch up.
 * The visible symptom was a frozen "Signing in…" spinner that a refresh
 * un-stuck.
 *
 * We return an explicit result rather than calling `redirect()` here so
 * the client can render localized error toasts and so unit tests can
 * exercise both branches without intercepting Next.js redirect signals.
 */
export async function signInAction(email: string, password: string): Promise<SignInActionResult> {
  try {
    const supabase = createServerActionClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: 'invalid_credentials' };
    }

    try {
      // findByAuthId throws if no `is_active = true` staff row exists for
      // this auth user. A signed-in auth user without a staff record (or
      // with `is_active = false`) must not retain a session — sign back
      // out so the middleware's JWT `is_active_staff` check matches
      // reality.
      const db = createSupabaseWrapper(supabase);
      await db.staff.findByAuthId(data.user.id);
    } catch (staffError) {
      Sentry.captureException(staffError, { tags: { context: 'sign-in-action-staff-lookup' } });
      await supabase.auth.signOut();
      return { ok: false, error: 'no_active_staff' };
    }

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'sign-in-action' } });
    return { ok: false, error: 'unexpected' };
  }
}
