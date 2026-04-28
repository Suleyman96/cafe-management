import type { PlanName } from '@gustri/core';
import { create } from 'zustand';
import { clearSessionStamp, writeSessionStamp } from '@/lib/session-stamp';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  tenantPlan: PlanName | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setTenantPlan: (plan: PlanName) => void;
  setIsLoading: (isLoading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  staff: null,
  tenantPlan: null,
  isLoading: true,
  setStaff: (staff) => {
    if (staff) {
      writeSessionStamp({ tenantId: staff.tenant_id, staffId: staff.id });
    } else {
      clearSessionStamp();
    }
    set({ staff, isLoading: false });
  },
  setTenantPlan: (tenantPlan) => set({ tenantPlan }),
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ staff: null, tenantPlan: null, isLoading: false }),
}));

/**
 * Selector hook for the current tenant id. Returns `null` until auth is ready.
 *
 * Use as an `enabled` guard on tenant-scoped queries so they don't fire before
 * the staff session has loaded — prevents wasted requests and accidental
 * cross-tenant fetches during sign-in transitions.
 */
export const useTenantId = (): string | null => useAuthStore((s) => s.staff?.tenant_id ?? null);
