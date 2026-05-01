import type { PlanName } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clearSessionStamp, writeSessionStamp } from '@/lib/session-stamp';
import { db } from '@/lib/supabase';
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
  setTenantPlan: (plan: PlanName | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  /**
   * Single entry point for moving the auth store between session states.
   * Boot and `onAuthStateChange` both call this — never set `staff` and
   * `tenantPlan` independently or you'll re-introduce the duplicate
   * `db.tenants.getCurrent()` race we hit before. Pass `null` to clear.
   */
  loadSession: (staff: Staff | null) => Promise<void>;
  reset: () => void;
}

/**
 * SecureStore-backed adapter for zustand `persist`. Keeps the persisted
 * snapshot off the OS file system in the clear (Keychain on iOS, Keystore-
 * encrypted SharedPreferences on Android). Async — `persist` handles that
 * transparently via `createJSONStorage`.
 */
const SECURE_STORE_KEY = 'gustri-auth-store';
const secureStoreAdapter = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
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
      loadSession: async (staff) => {
        if (staff) {
          writeSessionStamp({ tenantId: staff.tenant_id, staffId: staff.id });
        } else {
          clearSessionStamp();
        }

        if (!staff) {
          set({ staff: null, tenantPlan: null });
          return;
        }

        set({ staff });

        try {
          // Plan moved off `tenants.*` (M4 — column leak). Use the JWT-aware RPC.
          const plan = await db.tenants.getCurrentPlan();
          set({ tenantPlan: (plan as PlanName) ?? null });
        } catch (err) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'tenant plan fetch failed during loadSession',
            level: 'warning',
            data: { error: err instanceof Error ? err.message : String(err) },
          });
          set({ tenantPlan: null });
        }
      },
      reset: () => {
        set({ staff: null, tenantPlan: null, isLoading: false });
        // Wipe the persisted snapshot too — leaving it would let a logged-out
        // device hydrate the prior tenant on next launch.
        useAuthStore.persist.clearStorage();
      },
    }),
    {
      name: SECURE_STORE_KEY,
      storage: createJSONStorage(() => secureStoreAdapter),
      // Only `staff` is durable. `tenantPlan` is server-authoritative —
      // re-fetched via loadSession on every cold start. `isLoading` is a
      // boot-only flag that must default to true on relaunch.
      partialize: (state) => ({ staff: state.staff }),
    },
  ),
);

/**
 * Selector hook for the current tenant id. Returns `null` until auth is ready.
 *
 * Use as an `enabled` guard on tenant-scoped queries so they don't fire before
 * the staff session has loaded — prevents wasted requests and accidental
 * cross-tenant fetches during sign-in transitions.
 */
export const useTenantId = (): string | null => useAuthStore((s) => s.staff?.tenant_id ?? null);
