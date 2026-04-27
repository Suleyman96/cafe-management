import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '@/store/auth-store';
import type { Staff } from '@/types';
import { queryClient } from './query-client';
import { asyncStoragePersister } from './query-persister';
import { db, supabase } from './supabase';

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Fetch staff profile via wrapper
  const staff = (await db.staff.findByAuthId(data.user.id)) as Staff;

  if (!staff?.is_active) {
    await supabase.auth.signOut();
    throw new Error('Account is deactivated');
  }

  // Fire-and-forget — don't block login for a non-critical timestamp update
  db.staff.updateLastLogin(staff.id).catch(() => {});

  return { user: data.user, staff };
}

/**
 * Tear down local auth state without touching the Supabase session.
 *
 * Idempotent — safe to call multiple times. Also called from inside
 * `onAuthStateChange` when Supabase notifies us of a server-side sign-out
 * (token expiry, admin revocation, etc.) so we clean up locally without
 * recursing into supabase.auth.signOut.
 */
export async function cleanupClientState(): Promise<void> {
  const channels = supabase.getChannels();
  for (const channel of channels) {
    supabase.removeChannel(channel);
  }
  queryClient.clear();
  try {
    await asyncStoragePersister.removeClient();
  } catch {
    // Persister cleanup is best-effort; AsyncStorage failures shouldn't block logout.
  }
  useAuthStore.getState().clearAuth();
}

export type LogoutReason = 'user' | 'inactivity' | 'auth-change';

/**
 * Atomic logout — single source of truth for ending a session.
 *
 * Order matters: clear local state before `supabase.auth.signOut()` so the UI
 * transitions to the unauthenticated route immediately rather than briefly
 * rendering with stale cached data. The push-token clear runs first while we
 * still have `staff.id` in the store.
 */
export async function forceLogout(reason: LogoutReason = 'user'): Promise<void> {
  Sentry.addBreadcrumb({ category: 'auth', message: `forceLogout: ${reason}` });

  // Best-effort push-token clear — read staff.id before clearing the store.
  const staffId = useAuthStore.getState().staff?.id;
  if (staffId) {
    db.staff.updatePushToken(staffId, null).catch((err) => {
      Sentry.captureException(err, { tags: { area: 'logout.clearPushToken', reason } });
    });
  }

  await cleanupClientState();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (err: unknown) {
    // Local state already cleared, so the user is functionally logged out.
    // Server-side signOut failure is reported but doesn't reach the UI.
    Sentry.captureException(err, { tags: { area: 'logout.signOut', reason } });
  }
}

/**
 * @deprecated Use `forceLogout(reason)` instead. Kept temporarily for any
 * remaining call sites; will be removed once all migrate.
 */
export async function logout(): Promise<void> {
  await forceLogout('user');
}

export async function getCurrentUser(): Promise<Staff | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  try {
    const staff = (await db.staff.findByAuthId(user.id)) as Staff;
    if (!staff?.is_active) {
      await supabase.auth.signOut();
      return null;
    }
    return staff;
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback: (staff: Staff | null) => void) {
  // Track the last user identity we observed so we can detect a tenant
  // (= user) change mid-session. Without this, switching staff accounts on
  // the same device leaves the previous tenant's React Query cache in place,
  // which is a cross-tenant data-leak risk.
  let lastUserId: string | null = null;

  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      // Server-side sign-out (token expiry, admin revoke, or our own
      // forceLogout's signOut firing back through). Clean up locally.
      // cleanupClientState is idempotent so this is safe to repeat.
      lastUserId = null;
      await cleanupClientState();
      callback(null);
      return;
    }

    if (
      (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
      session.user
    ) {
      const newUserId = session.user.id;

      // Identity changed mid-session (different staff/tenant). Clear the
      // cache before loading the new staff so no stale data leaks across.
      // Skip on the very first observation (lastUserId === null) — that's
      // a normal sign-in, not a transition.
      if (lastUserId !== null && lastUserId !== newUserId) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'tenant transition: clearing cache',
          data: { from: lastUserId, to: newUserId },
        });
        await cleanupClientState();
      }

      lastUserId = newUserId;

      try {
        const staff = (await db.staff.findByAuthId(newUserId)) as Staff;
        if (!staff?.is_active) {
          await supabase.auth.signOut();
          callback(null);
          return;
        }
        callback(staff);
      } catch {
        callback(null);
      }
    }
  });
}
