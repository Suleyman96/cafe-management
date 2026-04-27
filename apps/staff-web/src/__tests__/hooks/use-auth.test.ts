import { act, renderHook, waitFor } from '@testing-library/react';
import { postLoginSideEffects, useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';
import { mockAdminStaff } from '../helpers/mock-auth';

// Override next/navigation mock with stable references to prevent
// infinite re-renders (useAuth depends on router.push in useEffect deps)
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  useAuthStore.setState({
    staff: null,

    isLoading: true,
  });
});

describe('postLoginSideEffects', () => {
  it('calls db.staff.updateLastLogin', async () => {
    await postLoginSideEffects('staff-1');
    expect(db.staff.updateLastLogin).toHaveBeenCalledWith('staff-1');
  });

  it('finds today schedules and clocks in the current shift via API', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');

    // A scheduled shift whose window covers "now"
    const scheduledEntry = {
      id: 'sched-1',
      status: 'scheduled',
      planned_start: `${h}:00`,
      planned_end: '23:59',
    };
    const completedEntry = {
      id: 'sched-2',
      status: 'completed',
      planned_start: '00:00',
      planned_end: '08:00',
    };

    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([
      scheduledEntry,
      completedEntry,
    ]);

    // clockViaApi needs a session with access_token
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: { session: { access_token: 'test-token' } },
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}'));

    await postLoginSideEffects('staff-1');

    await vi.waitFor(() => {
      expect(db.schedules.findByStaffAndDate).toHaveBeenCalledWith('staff-1', today);
    });

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/schedules/clock',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ scheduleId: 'sched-1', action: 'clock_in' }),
        }),
      );
    });

    fetchSpy.mockRestore();
  });

  it('does not crash when updateLastLogin fails', async () => {
    (db.staff.updateLastLogin as any).mockRejectedValueOnce(new Error('DB error'));
    // Should not throw
    await expect(postLoginSideEffects('staff-1')).resolves.not.toThrow();
  });

  it('does not crash when findByStaffAndDate fails', async () => {
    (db.schedules.findByStaffAndDate as any).mockRejectedValueOnce(new Error('DB error'));
    await expect(postLoginSideEffects('staff-1')).resolves.not.toThrow();
  });

  it('handles empty schedules array without calling clock API', async () => {
    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([]);
    const fetchSpy = vi.spyOn(global, 'fetch');

    await postLoginSideEffects('staff-1');

    await vi.waitFor(() => {
      expect(db.schedules.findByStaffAndDate).toHaveBeenCalled();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('skips non-scheduled shifts for clock-in', async () => {
    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([
      { id: 's1', status: 'in_progress', planned_start: '00:00', planned_end: '23:59' },
      { id: 's2', status: 'cancelled', planned_start: '00:00', planned_end: '23:59' },
    ]);

    const fetchSpy = vi.spyOn(global, 'fetch');

    await postLoginSideEffects('staff-1');

    await vi.waitFor(() => {
      expect(db.schedules.findByStaffAndDate).toHaveBeenCalled();
    });

    // No clock_in fetch — findCurrentOrNextShift only considers 'scheduled' status
    expect(fetchSpy).not.toHaveBeenCalledWith(
      '/api/schedules/clock',
      expect.objectContaining({
        body: expect.stringContaining('clock_in'),
      }),
    );

    fetchSpy.mockRestore();
  });
});

describe('useAuth', () => {
  describe('initial session check', () => {
    it('clears auth when no session exists', async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      expect(useAuthStore.getState().staff).toBeNull();
    });

    it('sets staff when session and staff record exist', async () => {
      // Mock twice: once for initial check, once for re-render when staff is set
      const validSession = { data: { session: { user: { id: 'auth-user-1' } } }, error: null };
      (supabase.auth.getSession as any)
        .mockResolvedValueOnce(validSession)
        .mockResolvedValueOnce(validSession);
      (db.staff.findByAuthId as any).mockResolvedValueOnce(mockAdminStaff);

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().staff).toEqual(mockAdminStaff);
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('signs out and clears auth when staff fetch fails', async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });
      (db.staff.findByAuthId as any).mockRejectedValueOnce(new Error('Not found'));

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
      });

      expect(useAuthStore.getState().staff).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('clears auth when getSession returns error', async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: new Error('Session error'),
      });

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      expect(useAuthStore.getState().staff).toBeNull();
    });

    it('verifies session when staff is already set', async () => {
      useAuthStore.setState({ staff: mockAdminStaff, isLoading: false });

      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(supabase.auth.getSession).toHaveBeenCalled();
      });

      // Staff should remain set since session is valid
      expect(useAuthStore.getState().staff).toEqual(mockAdminStaff);
    });
  });

  describe('return values', () => {
    it('returns isAuthenticated true when staff is set', () => {
      useAuthStore.setState({ staff: mockAdminStaff, isLoading: false });
      // Mock valid session so re-render doesn't clear auth
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.staff).toEqual(mockAdminStaff);
      expect(result.current.isLoading).toBe(false);
    });

    it('returns isAuthenticated false when staff is null', () => {
      useAuthStore.setState({ staff: null, isLoading: false });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('signs out, clears auth, and navigates to /login', async () => {
      useAuthStore.setState({ staff: mockAdminStaff, isLoading: false });
      // Only mock once — after logout clears staff, re-render should see no session
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().staff).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('does not crash when called while already logged out', async () => {
      useAuthStore.setState({ staff: null, isLoading: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      // signOut is still called (no-op at Supabase layer)
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().staff).toBeNull();
    });
  });

  describe('auth state change subscription', () => {
    it('sets up onAuthStateChange listener when effect runs', async () => {
      // staff must be null so the effect doesn't early-return
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
      });
    });

    it('cleans up subscription on unmount', async () => {
      const unsubscribe = vi.fn();
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as any).mockReturnValueOnce({
        data: { subscription: { unsubscribe } },
      });

      const { unmount } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('sessionCheckInProgress deduplication', () => {
    it('does not run concurrent session checks from two hook instances', async () => {
      // Make getSession hang so the flag stays true while second hook renders
      let resolveSession: (value: any) => void;
      (supabase.auth.getSession as any).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
      );

      renderHook(() => useAuth());
      renderHook(() => useAuth());

      // Only one getSession call because the flag blocks the second instance
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);

      // Clean up: resolve the pending promise so the flag resets in finally
      resolveSession!({ data: { session: null }, error: null });
      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });
    });

    it('resets flag after error so subsequent mount can check', async () => {
      // First mount: getSession rejects
      (supabase.auth.getSession as any).mockRejectedValueOnce(new Error('Network error'));

      const { unmount } = renderHook(() => useAuth());

      // Wait for check to complete (finally block resets flag)
      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      unmount();

      // Reset store for second mount
      useAuthStore.setState({ staff: null, isLoading: true });

      // Second mount should be able to run session check
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      renderHook(() => useAuth());

      await waitFor(() => {
        expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
      });
    });

    it('SIGNED_IN event triggers staff fetch via onAuthStateChange', async () => {
      let authCallback: (event: string, session: any) => Promise<void>;
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as any).mockImplementationOnce(
        (cb: (event: string, session: any) => Promise<void>) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      );

      renderHook(() => useAuth());

      // Wait for initial session check to complete
      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      // Simulate SIGNED_IN event — mock getSession for re-render when staff is set
      const mockStaff = {
        id: 'staff-1',
        tenant_id: 'test-tenant-id',
        full_name: 'Test User',
        role: 'waiter',
      };
      (db.staff.findByAuthId as any).mockResolvedValueOnce(mockStaff);
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });

      await act(async () => {
        await authCallback!('SIGNED_IN', { user: { id: 'auth-user-1' } });
      });

      expect(db.staff.findByAuthId).toHaveBeenCalledWith('auth-user-1');
      expect(useAuthStore.getState().staff).toEqual(mockStaff);
    });
  });
});
