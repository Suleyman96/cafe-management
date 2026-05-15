import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clearSessionStamp, writeSessionStamp } from '@/lib/session-stamp';
import type { Staff } from '@/types';

interface AuthStore {
  staff: Staff | null;
  isLoading: boolean;
  setStaff: (staff: Staff | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  /**
   * Single entry point for moving the auth store between session
   * states. Boot and `onAuthStateChange` both call this; it writes
   * (or clears) the session stamp and sets `staff`. The tenant plan
   * is **not** loaded here — it lives in the `useTenantPlan` query
   * from `@gustri/queries` so plan upgrades propagate on focus
   * without re-login.
   */
  loadSession: (staff: Staff | null) => void;
  reset: () => void;
}

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
      isLoading: true,
      setStaff: (staff) => {
        if (staff) {
          writeSessionStamp({ tenantId: staff.tenant_id, staffId: staff.id });
        } else {
          clearSessionStamp();
        }
        set({ staff, isLoading: false });
      },
      setIsLoading: (isLoading) => set({ isLoading }),
      loadSession: (staff) => {
        if (staff) {
          writeSessionStamp({ tenantId: staff.tenant_id, staffId: staff.id });
        } else {
          clearSessionStamp();
        }
        set({ staff });
      },
      reset: () => {
        set({ staff: null, isLoading: false });
        useAuthStore.persist.clearStorage();
      },
    }),
    {
      name: SECURE_STORE_KEY,
      storage: createJSONStorage(() => secureStoreAdapter),
      // Only `staff` is durable. `isLoading` is a boot-only flag that
      // must default to true on relaunch.
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
