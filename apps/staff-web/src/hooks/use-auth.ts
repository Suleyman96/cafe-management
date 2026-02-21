'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

// Global flag to prevent multiple concurrent session checks
let sessionCheckInProgress = false;

export function useAuth() {
  const router = useRouter();
  const { staff, isLoading, setStaff, setIsLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    // Skip if already have staff data or check is in progress
    if (staff || sessionCheckInProgress) {
      return;
    }

    sessionCheckInProgress = true;

    // Check for existing session
    const checkSession = async () => {
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
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .eq('is_active', true)
          .single();

        if (staffError || !staffData) {
          console.error('Staff fetch error:', staffError);
          await supabase.auth.signOut();
          clearAuth();
          return;
        }

        setStaff(staffData);
      } catch (error) {
        console.error('Auth check error:', error);
        clearAuth();
      } finally {
        setIsLoading(false);
        sessionCheckInProgress = false;
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAuth();
        router.push('/login');
      } else if (event === 'SIGNED_IN' && session.user) {
        // Fetch staff record
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .eq('is_active', true)
          .single();

        if (staffData) {
          setStaff(staffData);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [staff, clearAuth, router.push, setIsLoading, setStaff]);

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
