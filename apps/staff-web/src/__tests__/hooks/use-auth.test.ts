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
    user: null,
    isLoading: true,
  });
});

describe('postLoginSideEffects', () => {
  it('calls db.staff.updateLastLogin', async () => {
    await postLoginSideEffects('staff-1');
    expect(db.staff.updateLastLogin).toHaveBeenCalledWith('staff-1');
  });

  it('finds today schedules and marks scheduled ones as in-progress', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const scheduledEntry = { id: 'sched-1', status: 'scheduled' };
    const completedEntry = { id: 'sched-2', status: 'completed' };

    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([
      scheduledEntry,
      completedEntry,
    ]);

    await postLoginSideEffects('staff-1');

    await vi.waitFor(() => {
      expect(db.schedules.findByStaffAndDate).toHaveBeenCalledWith('staff-1', today);
    });

    await vi.waitFor(() => {
      expect(db.schedules.markInProgress).toHaveBeenCalledWith('sched-1', expect.any(String));
    });

    expect(db.schedules.markInProgress).not.toHaveBeenCalledWith('sched-2', expect.any(String));
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

  it('handles empty schedules array without calling markInProgress', async () => {
    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([]);
    await postLoginSideEffects('staff-1');
    expect(db.schedules.markInProgress).not.toHaveBeenCalled();
  });

  it('skips in_progress and cancelled schedules', async () => {
    (db.schedules.findByStaffAndDate as any).mockResolvedValueOnce([
      { id: 's1', status: 'in_progress' },
      { id: 's2', status: 'cancelled' },
    ]);

    await postLoginSideEffects('staff-1');

    await vi.waitFor(() => {
      expect(db.schedules.findByStaffAndDate).toHaveBeenCalled();
    });

    expect(db.schedules.markInProgress).not.toHaveBeenCalled();
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
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'auth-user-1' } } },
        error: null,
      });
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

    it('skips session check when staff is already set', () => {
      useAuthStore.setState({ staff: mockAdminStaff, user: mockAdminStaff, isLoading: false });

      renderHook(() => useAuth());

      expect(supabase.auth.getSession).not.toHaveBeenCalled();
    });
  });

  describe('return values', () => {
    it('returns isAuthenticated true when staff is set', () => {
      useAuthStore.setState({ staff: mockAdminStaff, user: mockAdminStaff, isLoading: false });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.staff).toEqual(mockAdminStaff);
      expect(result.current.isLoading).toBe(false);
    });

    it('returns isAuthenticated false when staff is null', () => {
      useAuthStore.setState({ staff: null, user: null, isLoading: false });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('signs out, clears auth, and navigates to /login', async () => {
      useAuthStore.setState({ staff: mockAdminStaff, user: mockAdminStaff, isLoading: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().staff).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('does not crash when called while already logged out', async () => {
      useAuthStore.setState({ staff: null, user: null, isLoading: false });

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
});
