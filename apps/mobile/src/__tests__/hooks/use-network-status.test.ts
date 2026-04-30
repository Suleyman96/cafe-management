import type { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetCaptivePortalForTests, useCaptivePortalStore } from '@/lib/captive-portal';

// NetInfo is a native module — replace it with a controllable test double
// so we can drive `setupOnlineManager` and assert how it gates onlineManager.
type Listener = (state: NetInfoState) => void;
const listeners: Listener[] = [];

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true } as NetInfoState),
    ),
    addEventListener: (l: Listener) => {
      listeners.push(l);
      return () => {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: { EXPO_PUBLIC_SUPABASE_URL: 'https://api.test' } },
  },
}));

import { setupOnlineManager } from '@/hooks/use-network-status';

function emitAndAwait(state: Partial<NetInfoState>) {
  const full = { isConnected: null, isInternetReachable: null, ...state } as NetInfoState;
  return Promise.all(listeners.map((l) => l(full)));
}

describe('setupOnlineManager — captive-portal / reachability gating', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listeners.length = 0;
    __resetCaptivePortalForTests();
    fetchMock = vi.fn(async () => ({ url: 'https://api.test/auth/v1/health' }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    setupOnlineManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
  });

  it('treats connected + reachable=true + HEAD success as online', async () => {
    await emitAndAwait({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
    expect(useCaptivePortalStore.getState().captivePortal).toBe(false);
  });

  it('flips offline + captivePortal=true when HEAD fails despite NetInfo claiming connected', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    await emitAndAwait({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(false);
    expect(useCaptivePortalStore.getState().captivePortal).toBe(true);
  });

  it('treats connected + reachable=false as offline without probing', async () => {
    await emitAndAwait({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);
    // No probe needed at this point.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats disconnected as offline regardless of reachability', async () => {
    await emitAndAwait({ isConnected: false, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a probe response from a foreign host (captive portal redirect) as unreachable', async () => {
    fetchMock.mockResolvedValueOnce({ url: 'https://hotel-login.example/login' } as Response);
    await emitAndAwait({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(false);
    expect(useCaptivePortalStore.getState().captivePortal).toBe(true);
  });
});
