import type { PlanName } from '@gustri/core';
import { create } from 'zustand';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  tenantPlan: PlanName | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setTenantPlan: (plan: PlanName) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  staff: null,
  tenantPlan: null,
  isLoading: true,
  setStaff: (staff) => set({ staff, isLoading: false }),
  setTenantPlan: (tenantPlan) => set({ tenantPlan }),
  setIsLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ staff: null, tenantPlan: null, isLoading: false }),
}));

/**
 * Selector hook for the current tenant id. Returns `null` until auth is ready.
 *
 * Use as an `enabled` guard on tenant-scoped queries so they don't fire before
 * the staff session has loaded — prevents wasted requests and accidental
 * cross-tenant fetches during sign-in transitions.
 */
export const useTenantId = (): string | null => useAuthStore((s) => s.staff?.tenant_id ?? null);
