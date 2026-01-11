import { create } from "zustand";
import type { Staff } from "@/types";

interface AuthStore {
  staff: Staff | null;
  user: Staff | null; // Alias for staff
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  staff: null,
  user: null,
  isLoading: true,
  setStaff: (staff) => set({ staff, user: staff, isLoading: false }),
  setIsLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ staff: null, user: null, isLoading: false }),
}));


