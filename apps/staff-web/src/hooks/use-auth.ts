'use client';

import type { Database } from '@gustri/database';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

// Global flag to prevent multiple concurrent session checks
let sessionCheckInProgress = false;

export function useAuth() {
  const router = useRouter();
  const { staff, isLoading, setStaff, setTenantPlan, setIsLoading, clearAuth } = useAuthStore();

  // Always initialize the Supabase session from localStorage and listen for changes.
  // This must run even when Zustand already has staff data (e.g. after page refresh),
  // otherwise the Supabase client won't have the JWT and mutations fail as anon.
  useEffect(() => {
    const initSession = async () => {
      // If Zustand already has staff, just ensure the Supabase session is loaded
      if (staff) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          // Supabase session expired but Zustand still has stale data
          clearAuth();
          router.push('/login');
        }
        return;
      }

      // No staff in store — do full session check
      if (sessionCheckInProgress) return;
      sessionCheckInProgress = true;
      setIsLoading(true);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          clearAuth();
          return;
        }

        if (!session?.user) {
          clearAuth();
          return;
        }

        // Fetch staff record
        let staffData: Staff | null = null;
        try {
          staffData = (await db.staff.findByAuthId(session.user.id)) as Staff;
        } catch (staffError) {
          console.error('Staff fetch error:', staffError);
          await supabase.auth.signOut();
          clearAuth();
          return;
        }

        setStaff(staffData);
        postLoginSideEffects(staffData.id);

        // Fetch tenant plan
        db.tenants
          .getCurrent()
          .then((tenant) => setTenantPlan(tenant.plan as any))
          .catch(console.warn);
      } catch (error) {
        console.error('Auth check error:', error);
        clearAuth();
      } finally {
        setIsLoading(false);
        sessionCheckInProgress = false;
      }
    };

    initSession();

    // Always listen for auth changes (session expiry, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAuth();
        router.push('/login');
      } else if (event === 'SIGNED_IN' && session.user) {
        try {
          const staffData = (await db.staff.findByAuthId(session.user.id)) as Staff;
          setStaff(staffData);
          postLoginSideEffects(staffData.id);
          db.tenants
            .getCurrent()
            .then((tenant) => setTenantPlan(tenant.plan as any))
            .catch(console.warn);
        } catch {
          // Staff record not found — ignore
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [staff, clearAuth, router.push, setIsLoading, setStaff, setTenantPlan]);

  const logout = async () => {
    await supabase.auth.signOut();
    clearAuth();
    router.push('/login');
  };

  return {
    staff,
    isLoading,
    isAuthenticated: !!staff,
    logout,
  };
}
