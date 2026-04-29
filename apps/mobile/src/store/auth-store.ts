import type { PlanName } from '@gustri/core';
import { create } from 'zustand';
import { clearSessionStamp, writeSessionStamp } from '@/lib/session-stamp';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  /**
   * Client-side plan hint for UI gating only. **Never authoritative** —
   * the server independently enforces every plan-gated mutation via
   * `verifyPlan` (`/api/v1/*` routes) and the `plan_allows_feature(...)`
   * RLS check (direct-wrapper writes to tasks/waste_logs/stock/schedules).
   * Do not add a new client-only gate without a matching server check.
   * See plans/mobile-audit-2026-04/01-CRITICAL.md C5.
   */
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
