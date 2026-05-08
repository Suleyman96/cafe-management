import * as Sentry from '@sentry/react-native';
import { clearPushTokenSyncCache, readLastSyncedExpoToken } from '@/hooks/use-push-token-sync';
import { useAuthStore } from '@/store/auth-store';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';
import type { Staff } from '@/types';
import { clearLastActiveAt } from './last-active-at';
import { resetNavigationStackMonitor } from './navigation-stack-monitor';
import { drainPendingRevokes, enqueuePendingRevoke } from './pending-revokes';
import { queryClient } from './query-client';
import { asyncStoragePersister, clearEncryptedQueryCache } from './query-persister';
import { clearSessionStamp } from './session-stamp';
import { db, supabase } from './supabase';

/**
 * Per-channel timeout when tearing down realtime subscriptions during logout.
 * Supabase's `removeChannel` waits for a phx_leave ack from the server (~10s
 * default). On dead networks that's an unacceptable logout delay, so we cap
 * the wait and let the leave message fire-and-forget over the wire — the
 * channel is removed from the local registry synchronously regardless, which
 * is what protects the next user's session.
 */
const CHANNEL_TEARDOWN_TIMEOUT_MS = 2_000;

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
 *
 * Awaits every step (cancel in-flight queries, clear cache, remove the
 * persister blob, clear the push-token dedup cache, clear the session
 * stamp, reset the auth store). Callers — most importantly the auth gate
 * in `RootNavigator` — rely on `await cleanupClientState()` resolving
 * before the navigator flips `staff = null`, otherwise a paused mutation
 * could replay under the next user's session before its cache entry has
 * been wiped. Flips `isLoading: true` for the duration so the navigator
 * shows the splash drain loader instead of a half-cleared previous tenant.
 */
export async function cleanupClientState(): Promise<void> {
  useAuthStore.getState().setIsLoading(true);
  try {
    // Tear down every realtime channel before clearing the cache. Supabase's
    // `removeChannel` removes the channel from the client's local registry
    // synchronously and returns a Promise that resolves when the WS leave
    // message is acked — which can hang indefinitely on a dead network.
    // Awaiting bounds the cross-tenant race window: until every channel
    // teardown resolves (or times out), a postgres_changes event from the
    // previous tenant could still hit `queryClient.invalidateQueries` and
    // re-fetch under the next user's auth token. We cap the wait so logout
    // on flaky cafe Wi-Fi doesn't stall the UI.
    const channels = supabase.getChannels();
    if (channels.length > 0) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: `cleanupClientState: tearing down ${channels.length} realtime channel(s)`,
        data: { count: channels.length },
      });
      await Promise.all(
        channels.map((channel) => {
          const removal = Promise.resolve(supabase.removeChannel(channel)).catch((err) => {
            Sentry.captureException(err, { tags: { area: 'logout.removeChannel' } });
          });
          const timeout = new Promise<void>((resolve) => {
            setTimeout(() => {
              Sentry.addBreadcrumb({
                category: 'auth',
                message: 'cleanupClientState: channel removal timed out',
                level: 'warning',
              });
              resolve();
            }, CHANNEL_TEARDOWN_TIMEOUT_MS);
          });
          return Promise.race([removal, timeout]);
        }),
      );
    }
    // Drop tracked channel statuses so the next session doesn't inherit a
    // stale `degraded`/`reconnecting` badge from the previous user.
    useRealtimeStatusStore.getState().clearAll();
    // Re-arm the navigation stack-depth monitor so the next session gets
    // its own first-crossing report if a regression also affects them.
    resetNavigationStackMonitor();
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      await asyncStoragePersister.removeClient();
    } catch {
      // Persister cleanup is best-effort; AsyncStorage failures shouldn't block logout.
    }
    // Wipe the encrypted MMKV instance entirely (not just the React Query
    // blob) so any throttled-write debris or unrelated keys can't outlive
    // the session. Pairs with `removeClient()` above — that drops the
    // persisted client key; this drops everything else.
    clearEncryptedQueryCache();
    // Drop the push-token dedup cache so the next user re-syncs immediately
    // rather than skipping on a stale composite from the previous session.
    clearPushTokenSyncCache();
    clearSessionStamp();
    clearLastActiveAt();
    // Clear the wrapper's defense-in-depth tenant context (H5) so the
    // next user's reads bind their own tenant id rather than inheriting
    // the previous session's.
    db.setTenantContext(null);
    // `reset()` clears the persisted SecureStore snapshot too — without that,
    // the next cold launch would hydrate the prior tenant before getCurrentUser()
    // resolves, briefly painting the authed stack for someone who is logged out.
    useAuthStore.getState().reset();
  } catch (err) {
    // Ensure the drain gate releases even if a step throws — the user is
    // still effectively logged out locally.
    useAuthStore.getState().reset();
    throw err;
  }
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

  // Enqueue a server-side revoke into the persistent queue, then opportun-
  // istically drain it. Online: drain succeeds, queue is empty. Offline:
  // drain fails, the entry stays for the next online drain (App.tsx boot
  // hook). Without the queue, an offline logout — the common end-of-shift
  // case on flaky cafe Wi-Fi — would leave the prior tenant's token bound
  // server-side, and the next user on the device would receive their
  // notifications.
  const staffId = useAuthStore.getState().staff?.id;
  const expoToken = staffId ? readLastSyncedExpoToken(staffId) : null;
  if (expoToken) {
    try {
      await enqueuePendingRevoke(expoToken);
    } catch (err) {
      Sentry.captureException(err, { tags: { area: 'logout.enqueueRevoke', reason } });
    }
    // Fire-and-forget online attempt — actual retry lives in the queue.
    drainPendingRevokes().catch((err) => {
      Sentry.captureException(err, { tags: { area: 'logout.drainRevokes', reason } });
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
    // Bind the wrapper's defense-in-depth tenant context (H5) so every
    // subsequent read appends `.eq('tenant_id', tenantId)`.
    db.setTenantContext(staff.tenant_id);
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
