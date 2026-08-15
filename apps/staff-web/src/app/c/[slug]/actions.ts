'use server';

import { createSupabaseWrapper } from '@gustri/api-client';
import type { Staff } from '@gustri/database/types';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { createServerActionClient } from '@/lib/supabase/server';

export type CafeSignInResult =
  | { ok: true; session: { access_token: string; refresh_token: string }; staff: Staff }
  // One generic error for every failure (unknown cafe, unknown user, wrong
  // password, inactive) so login never reveals which cafes or usernames exist.
  | { ok: false; error: 'invalid_credentials' | 'unexpected' };

/** Escape PostgREST `ilike` wildcards so a username with % or _ can't match broadly. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Cafe-scoped sign-in: (cafe slug, username, password).
 *
 * Staff "emails" are per-cafe usernames (often fake), so the same string can
 * exist in many cafes. We resolve within the cafe: slug → tenant → the staff
 * row for that username → its real (internal, possibly synthetic) auth email →
 * then the normal password sign-in. Because the lookup is tenant-scoped, the
 * same username at two cafes maps to two different accounts.
 *
 * Resolution uses the service role (an unauthenticated caller can't read
 * tenants/staff through RLS); the actual sign-in uses the server-action client
 * so the session cookies land on the response (same pattern as signInAction).
 */
export async function signInWithCafeAction(
  slug: string,
  identifier: string,
  password: string,
): Promise<CafeSignInResult> {
  try {
    const admin = getSupabaseAdmin();

    // slug → tenant
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, is_active')
      .eq('slug', slug)
      .maybeSingle();
    if (!tenant || tenant.is_active === false) {
      return { ok: false, error: 'invalid_credentials' };
    }

    // (tenant, username) → active staff row → auth user
    const { data: staffRow } = await admin
      .from('staff')
      .select('auth_user_id, is_active')
      .eq('tenant_id', tenant.id)
      .ilike('email', escapeLike(identifier))
      .maybeSingle();
    if (!staffRow?.auth_user_id || staffRow.is_active === false) {
      return { ok: false, error: 'invalid_credentials' };
    }

    // Resolve the real login email for that account (synthetic for staff, real
    // for owners) — the value we actually authenticate with.
    const { data: authUser } = await admin.auth.admin.getUserById(staffRow.auth_user_id);
    const loginEmail = authUser?.user?.email;
    if (!loginEmail) {
      return { ok: false, error: 'invalid_credentials' };
    }

    // Verify the password + land the session cookies.
    const supabase = createServerActionClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (error || !data.user || !data.session) {
      return { ok: false, error: 'invalid_credentials' };
    }

    // Defense-in-depth: the signed-in account must be the one we resolved in
    // this cafe. (Guards against any mismatch between resolution and sign-in.)
    if (data.user.id !== staffRow.auth_user_id) {
      await supabase.auth.signOut();
      return { ok: false, error: 'invalid_credentials' };
    }

    let staff: Staff;
    try {
      staff = (await createSupabaseWrapper(supabase).staff.findByAuthId(data.user.id)) as Staff;
    } catch {
      await supabase.auth.signOut();
      return { ok: false, error: 'invalid_credentials' };
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
    Sentry.captureException(err, { tags: { context: 'cafe-sign-in-action' } });
    return { ok: false, error: 'unexpected' };
  }
}
