import type { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { setupOnlineManager } from '@/hooks/use-network-status';

function emit(state: Partial<NetInfoState>) {
  for (const l of listeners)
    l({ isConnected: null, isInternetReachable: null, ...state } as NetInfoState);
}

describe('setupOnlineManager — captive-portal / reachability gating', () => {
  beforeEach(() => {
    listeners.length = 0;
    setupOnlineManager();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('treats connected + reachable=true as online', () => {
    emit({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('treats connected + reachable=false as offline (captive portal)', () => {
    emit({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('treats connected + reachable=null as online (boot probe pending)', () => {
    emit({ isConnected: true, isInternetReachable: null });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('treats disconnected as offline regardless of reachability', () => {
    emit({ isConnected: false, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(false);
  });
});
