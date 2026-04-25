import { useAuthStore } from '@/store/auth-store';
import { mockAdminStaff } from '../helpers/mock-auth';

beforeEach(() => {
  useAuthStore.setState({
    staff: null,
    isLoading: true,
  });
});

describe('useAuthStore', () => {
  it('has correct default state', () => {
    const state = useAuthStore.getState();
    expect(state.staff).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  describe('setStaff', () => {
    it('sets staff and sets isLoading to false', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);

      const state = useAuthStore.getState();
      expect(state.staff).toEqual(mockAdminStaff);
      expect(state.isLoading).toBe(false);
    });

    it('sets staff to null when passed null', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);
      useAuthStore.getState().setStaff(null);

      const state = useAuthStore.getState();
      expect(state.staff).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setIsLoading', () => {
    it('only changes isLoading', () => {
      useAuthStore.getState().setIsLoading(false);

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.staff).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('resets all fields', () => {
      useAuthStore.getState().setStaff(mockAdminStaff);
      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.staff).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
