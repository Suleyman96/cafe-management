import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Staff } from '@/types';
import { useAuthStore } from '../auth-store';

vi.mock('@/lib/session-stamp', () => ({
  writeSessionStamp: vi.fn(),
  clearSessionStamp: vi.fn(),
}));

const tenantsGetCurrentPlan = vi.fn();

vi.mock('@/lib/supabase', () => ({
  db: {
    tenants: {
      getCurrentPlan: (...args: unknown[]) => tenantsGetCurrentPlan(...args),
    },
  },
}));

const STAFF: Staff = {
  id: 'staff-1',
  tenant_id: 'tenant-1',
  role: 'admin',
  is_active: true,
} as unknown as Staff;

const STORAGE_KEY = 'gustri-auth-store';

describe('useAuthStore.loadSession', () => {
  beforeEach(async () => {
    useAuthStore.setState({ staff: null, tenantPlan: null, isLoading: true });
    tenantsGetCurrentPlan.mockReset();
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  });

  it('clears staff and tenantPlan when called with null', async () => {
    useAuthStore.setState({ staff: STAFF, tenantPlan: 'pro' });
    await useAuthStore.getState().loadSession(null);
    expect(useAuthStore.getState().staff).toBeNull();
    expect(useAuthStore.getState().tenantPlan).toBeNull();
    expect(tenantsGetCurrentPlan).not.toHaveBeenCalled();
  });

  it('sets staff and fetches tenantPlan once when called with a staff', async () => {
    // getCurrentPlan returns the plan string directly (RPC), not a row.
    tenantsGetCurrentPlan.mockResolvedValueOnce('pro');
    await useAuthStore.getState().loadSession(STAFF);
    expect(useAuthStore.getState().staff).toBe(STAFF);
    expect(useAuthStore.getState().tenantPlan).toBe('pro');
    expect(tenantsGetCurrentPlan).toHaveBeenCalledTimes(1);
  });

  it('leaves tenantPlan null when the fetch fails (does not throw)', async () => {
    tenantsGetCurrentPlan.mockRejectedValueOnce(new Error('network'));
    await useAuthStore.getState().loadSession(STAFF);
    expect(useAuthStore.getState().staff).toBe(STAFF);
    expect(useAuthStore.getState().tenantPlan).toBeNull();
  });
});

describe('useAuthStore persistence', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    useAuthStore.setState({ staff: null, tenantPlan: null, isLoading: true });
    tenantsGetCurrentPlan.mockReset();
  });

  async function waitForPersistedWrite() {
    // zustand persist writes asynchronously when the storage adapter is async.
    // Yield once so the SecureStore.setItemAsync resolves.
    await Promise.resolve();
    await Promise.resolve();
  }

  it('writes staff to SecureStore on set, omits tenantPlan and isLoading', async () => {
    useAuthStore.setState({ staff: STAFF, tenantPlan: 'pro', isLoading: false });
    await waitForPersistedWrite();
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state).toEqual({ staff: STAFF });
    expect(parsed.state.tenantPlan).toBeUndefined();
    expect(parsed.state.isLoading).toBeUndefined();
  });

  it('reset() clears the persisted snapshot', async () => {
    useAuthStore.setState({ staff: STAFF });
    await waitForPersistedWrite();
    expect(await SecureStore.getItemAsync(STORAGE_KEY)).not.toBeNull();
    useAuthStore.getState().reset();
    await waitForPersistedWrite();
    expect(await SecureStore.getItemAsync(STORAGE_KEY)).toBeNull();
  });
});
