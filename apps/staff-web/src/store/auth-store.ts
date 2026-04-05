import type { PlanName } from '@gustri/core';
import { create } from 'zustand';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  user: Staff | null; // Alias for staff
  tenantPlan: PlanName | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setTenantPlan: (plan: PlanName) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  staff: null,
  user: null,
  tenantPlan: null,
  isLoading: true,
  setStaff: (staff) => set({ staff, user: staff, isLoading: false }),
  setTenantPlan: (tenantPlan) => set({ tenantPlan }),
  setIsLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ staff: null, user: null, tenantPlan: null, isLoading: false }),
}));
