import { useAuthStore } from '@/store/auth-store';
import { mockAdminStaff } from '../helpers/mock-auth';

beforeEach(() => {
  useAuthStore.setState({
    staff: null,
    user: null,
    isLoading: true,
  });
});

describe('useAuthStore', () => {
  it('has correct default state', () => {
    const state = useAuthStore.getState();
    expect(state.staff).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  describe('setStaff', () => {
    it('sets staff and user (alias), sets isLoading to false', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);

      const state = useAuthStore.getState();
      expect(state.staff).toEqual(mockAdminStaff);
      expect(state.user).toEqual(mockAdminStaff);
      expect(state.isLoading).toBe(false);
    });

    it('sets both to null when passed null', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);
      useAuthStore.getState().setStaff(null);

      const state = useAuthStore.getState();
      expect(state.staff).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('user always mirrors staff', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);
      expect(useAuthStore.getState().user).toBe(useAuthStore.getState().staff);

      useAuthStore.getState().setStaff(null);
      expect(useAuthStore.getState().user).toBe(useAuthStore.getState().staff);
    });
  });

  describe('setIsLoading', () => {
    it('only changes isLoading', () => {
      useAuthStore.getState().setIsLoading(false);

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.staff).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('resets all fields', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);
      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.staff).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
