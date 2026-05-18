'use server';

import { createSupabaseWrapper } from '@gustri/api-client';
import type { Staff } from '@gustri/database';
import * as Sentry from '@sentry/nextjs';
import { createServerActionClient } from '@/lib/supabase/server';

export type SignInErrorCode = 'invalid_credentials' | 'no_active_staff' | 'unexpected';

export type SignInActionResult =
  | {
      ok: true;
      // Echoed back so the client can call `supabase.auth.setSession()` and
      // prime the browser-side SDK singleton. The same tokens are also in
      // the Set-Cookie headers attached to this response, but the in-memory
      // SDK doesn't auto-sync from cookies that arrive externally (it ran
      // `_initialize()` once on /login when no session existed). Without
      // this hand-off the SDK's first `onAuthStateChange` subscriber fires
      // INITIAL_SESSION with `null`, and `useAuth` bounces the user back to
      // /login — the "have to refresh several times to log in" symptom.
      session: { access_token: string; refresh_token: string };
      staff: Staff;
    }
  | { ok: false; error: SignInErrorCode };

/**
 * Server-side sign-in.
 *
 * The action does three jobs that the client can't do alone:
 *  1. Validates the credentials (signInWithPassword).
 *  2. Verifies an active staff row exists for the auth user. We don't
 *     leave dangling Supabase sessions for users without a staff record.
 *  3. Lands the auth cookies on the action's HTTP response via
 *     `createServerActionClient`, so the *next* navigation request
 *     already carries them — the middleware's `getSession()` check
 *     passes on the first try and the user isn't bounced.
 *
 * Cookies alone aren't enough to make the client SDK happy though: the
 * browser singleton in `lib/supabase/client.ts` already initialized
 * without a session on /login, and the SDK won't notice cookies that
 * appear later. So we also return the session tokens + the staff row
 * so the client can `setSession(...)` + `installSession(...)` before
 * navigating. See `app/login/page.tsx` for the client half.
 *
 * Explicit result rather than `redirect()` so the client can render
 * localized error toasts and unit tests can exercise both branches
 * without intercepting Next.js redirect signals.
 */
export async function signInAction(email: string, password: string): Promise<SignInActionResult> {
  try {
    const supabase = createServerActionClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return { ok: false, error: 'invalid_credentials' };
    }

    let staff: Staff;
    try {
      // findByAuthId throws if no `is_active = true` staff row exists for
      // this auth user. A signed-in auth user without a staff record (or
      // with `is_active = false`) must not retain a session — sign back
      // out so the middleware's JWT `is_active_staff` check matches
      // reality.
      const db = createSupabaseWrapper(supabase);
      staff = (await db.staff.findByAuthId(data.user.id)) as Staff;
    } catch (staffError) {
      Sentry.captureException(staffError, { tags: { context: 'sign-in-action-staff-lookup' } });
      await supabase.auth.signOut();
      return { ok: false, error: 'no_active_staff' };
    }

    return {
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      staff,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'sign-in-action' } });
    return { ok: false, error: 'unexpected' };
  }
}
