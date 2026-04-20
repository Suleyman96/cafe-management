'use client';

import type { Database } from '@gustri/database';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

type Staff = Database['public']['Tables']['staff']['Row'];
type StaffSchedule = Database['public']['Tables']['staff_schedules']['Row'];

/** Fire-and-forget post-login side effects */
export async function postLoginSideEffects(staffId: string) {
  db.staff.updateLastLogin(staffId).catch(console.warn);

  const today = new Date().toLocaleDateString('en-CA');
  (db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>)
    .then((schedules) => {
      for (const schedule of schedules) {
        if (schedule.status === 'scheduled') {
          db.schedules.markInProgress(schedule.id, new Date().toISOString()).catch(console.warn);
        }
      }
    })
    .catch(console.warn);
}

// Deduplication: concurrent callers (e.g., React StrictMode double-mount)
// await the same promise. The `cancelled` flag in useEffect handles cleanup
// if the component unmounts before the check completes. This is safe because
// JS is single-threaded — the check-and-assign at the call site is atomic.
let sessionCheckPromise: Promise<void> | null = null;

async function loadStaffAndSetup(
  userId: string,
  setStaff: (s: Staff) => void,
  setTenantPlan: (p: any) => void,
) {
  const staffData = (await db.staff.findByAuthId(userId)) as Staff;
  setStaff(staffData);
  postLoginSideEffects(staffData.id);

  if (staffData.preferred_language && staffData.preferred_language !== 'en') {
    loadAndSwitchLanguage(staffData.preferred_language).catch(console.warn);
  }

  db.tenants
    .getCurrent()
    .then((tenant) => setTenantPlan(tenant.plan as any))
    .catch(console.warn);
}

export function useAuth() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { staff, isLoading, setStaff, setTenantPlan, setIsLoading, clearAuth } = useAuthStore();

  const stableLogout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
    routerRef.current.push('/login');
  }, [clearAuth]);

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
