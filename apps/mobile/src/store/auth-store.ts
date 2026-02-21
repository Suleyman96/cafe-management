import { create } from 'zustand';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  staff: null,
  isLoading: true,
  setStaff: (staff) => set({ staff, isLoading: false }),
  setIsLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ staff: null, isLoading: false }),
}));
