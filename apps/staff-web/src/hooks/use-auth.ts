'use client';

import type { PlanName } from '@gustri/core';
import type { Database } from '@gustri/database';
import * as Sentry from '@sentry/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

type Staff = Database['public']['Tables']['staff']['Row'];
type StaffSchedule = Database['public']['Tables']['staff_schedules']['Row'];

async function clockViaApi(scheduleId: string, action: 'clock_in' | 'clock_out') {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch('/api/v1/schedules/clock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ scheduleId, action }),
  });
}

/**
 * Find the shift whose planned window covers "now", or the next upcoming
 * scheduled shift if none is active yet. Returns null when nothing qualifies.
 */
function findCurrentOrNextShift(schedules: StaffSchedule[]): StaffSchedule | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // First: find a scheduled shift whose window covers now
  for (const s of schedules) {
    if (s.status !== 'scheduled') continue;
    const start = toMinutes(s.planned_start);
    const end = toMinutes(s.planned_end);
    if (nowMinutes >= start && nowMinutes < end) return s;
  }

  // Second: find the next upcoming scheduled shift
  let nearest: StaffSchedule | null = null;
  let nearestDiff = Infinity;
  for (const s of schedules) {
    if (s.status !== 'scheduled') continue;
    const start = toMinutes(s.planned_start);
    const diff = start - nowMinutes;
    if (diff > 0 && diff < nearestDiff) {
      nearest = s;
      nearestDiff = diff;
    }
  }

  return nearest;
}

/** Fire-and-forget post-login side effects */
export async function postLoginSideEffects(staffId: string) {
  db.staff.updateLastLogin(staffId).catch((err) => {
    Sentry.captureException(err, { tags: { context: 'post-login-update-last-login' } });
  });

  const today = new Date().toLocaleDateString('en-CA');
  (db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>)
    .then(async (schedules) => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      // Auto-complete: in_progress shifts whose planned_end has passed
      for (const s of schedules) {
        if (s.status === 'in_progress' && toMinutes(s.planned_end) <= nowMinutes) {
          clockViaApi(s.id, 'clock_out').catch((err) => {
            Sentry.captureException(err, { tags: { context: 'auto-complete-schedule' } });
          });
        }
      }

      // Auto-missed: scheduled shifts whose planned_end has passed
      // (use direct API since there's no "mark missed" clock action — admin client handles this)
      // These are fire-and-forget; if RLS blocks it, it's fine — admins will see them.

      // Auto clock-in: only the current or next upcoming shift
      const target = findCurrentOrNextShift(schedules);
      if (target) {
        clockViaApi(target.id, 'clock_in').catch((err) => {
          Sentry.captureException(err, { tags: { context: 'post-login-clock-in' } });
        });
      }
    })
    .catch((err) => {
      Sentry.captureException(err, { tags: { context: 'post-login-find-schedules' } });
    });
}

// Deduplication: concurrent callers (e.g., React StrictMode double-mount)
// await the same promise. The `cancelled` flag in useEffect handles cleanup
// if the component unmounts before the check completes. This is safe because
// JS is single-threaded — the check-and-assign at the call site is atomic.
let sessionCheckPromise: Promise<void> | null = null;

async function loadStaffAndSetup(
  userId: string,
  setStaff: (s: Staff) => void,
  setTenantPlan: (p: PlanName) => void,
) {
  const staffData = (await db.staff.findByAuthId(userId)) as Staff;
  // Bind the wrapper tenant context for the defense-in-depth tenant
  // predicate (H5). Every subsequent wrapper read appends
  // `.eq('tenant_id', tenantId)`. Sign-out clears it via clearAuth().
  db.setTenantContext(staffData.tenant_id);
  setStaff(staffData);
  postLoginSideEffects(staffData.id);

  if (staffData.preferred_language && staffData.preferred_language !== 'en') {
    loadAndSwitchLanguage(staffData.preferred_language).catch((err) => {
      Sentry.captureException(err);
    });
  }

  db.tenants
    .getCurrent()
    .then((tenant) => setTenantPlan(tenant.plan as PlanName))
    .catch((err) => {
      Sentry.captureException(err, { tags: { context: 'post-login-tenant-plan' } });
    });
}

export function useAuth() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { staff, isLoading, setStaff, setTenantPlan, setIsLoading, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const stableLogout = useCallback(async () => {
    await supabase.auth.signOut();
    db.setTenantContext(null);
    // Belt-and-braces: RealtimeAuthBridge also clears the cache on
    // SIGNED_OUT, but onAuthStateChange fires asynchronously. Wiping
    // here too guarantees no stale tenant data lingers between the
    // signOut() resolve and the bridge handler running.
    queryClient.clear();
    clearAuth();
    routerRef.current.push('/login');
  }, [clearAuth, queryClient]);

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      // If Zustand already has staff, just ensure the Supabase session is loaded
      if (staff) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session && !cancelled) {
          clearAuth();
          routerRef.current.push('/login');
        }
        return;
      }

      // If another caller is already checking, wait for it instead of returning early
      if (sessionCheckPromise) {
        await sessionCheckPromise;
        // If staff was loaded (or auth cleared), we're done
        if (useAuthStore.getState().staff || !useAuthStore.getState().isLoading) {
          return;
        }
        // Otherwise, the previous check was cancelled (e.g. StrictMode) — fall through
      }

      setIsLoading(true);

      sessionCheckPromise = (async () => {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (cancelled) return;

          if (sessionError) {
            Sentry.captureException(sessionError);
            clearAuth();
            return;
          }

          if (!session?.user) {
            clearAuth();
            return;
          }

          try {
            await loadStaffAndSetup(session.user.id, setStaff, setTenantPlan);
          } catch (staffError) {
            Sentry.captureException(staffError);
            if (!cancelled) {
              await supabase.auth.signOut();
              clearAuth();
            }
          }
        } catch (error) {
          Sentry.captureException(error);
          if (!cancelled) clearAuth();
        } finally {
          if (!cancelled) setIsLoading(false);
          sessionCheckPromise = null;
        }
      })();

      await sessionCheckPromise;
    };

    initSession();

    // Listen for auth changes (session expiry, sign out, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT' || !session) {
        clearAuth();
        routerRef.current.push('/login');
      } else if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
        session.user
      ) {
        // Only load staff if we don't have it yet
        if (!useAuthStore.getState().staff) {
          try {
            await loadStaffAndSetup(session.user.id, setStaff, setTenantPlan);
            setIsLoading(false);
          } catch (err) {
            Sentry.captureException(err);
            if (!cancelled) {
              await supabase.auth.signOut();
              clearAuth();
            }
          }
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [staff, clearAuth, setIsLoading, setStaff, setTenantPlan]);

  return {
    staff,
    isLoading,
    isAuthenticated: !!staff,
    logout: stableLogout,
  };
}
