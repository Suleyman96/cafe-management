import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Staff } from '@/types';
import { useAuthStore } from '../auth-store';

vi.mock('@/lib/session-stamp', () => ({
  writeSessionStamp: vi.fn(),
  clearSessionStamp: vi.fn(),
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
    useAuthStore.setState({ staff: null, isLoading: true });
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  });

  it('clears staff when called with null', () => {
    useAuthStore.setState({ staff: STAFF });
    useAuthStore.getState().loadSession(null);
    expect(useAuthStore.getState().staff).toBeNull();
  });

  it('sets staff when called with a staff record', () => {
    useAuthStore.getState().loadSession(STAFF);
    expect(useAuthStore.getState().staff).toBe(STAFF);
  });
});

describe('useAuthStore persistence', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    useAuthStore.setState({ staff: null, isLoading: true });
  });

  async function waitForPersistedWrite() {
    // zustand persist writes asynchronously when the storage adapter is async.
    // Yield once so the SecureStore.setItemAsync resolves.
    await Promise.resolve();
    await Promise.resolve();
  }

  it('writes staff to SecureStore on set, omits isLoading', async () => {
    useAuthStore.setState({ staff: STAFF, isLoading: false });
    await waitForPersistedWrite();
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state).toEqual({ staff: STAFF });
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
