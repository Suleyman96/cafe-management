import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` factories are hoisted above all imports — stub out the heavy
// transitive deps that auth.ts pulls in so the suite doesn't try to spin up
// expo-constants / AsyncStorage / MMKV in the test environment. Keep the
// surface narrow: only the symbols cleanupClientState actually calls.
vi.mock('@/lib/query-persister', () => ({
  asyncStoragePersister: { removeClient: vi.fn().mockResolvedValue(undefined) },
  clearEncryptedQueryCache: vi.fn(),
}));

vi.mock('@/lib/query-client', () => ({
  queryClient: {
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  },
}));

vi.mock('@/hooks/use-push-token-sync', () => ({
  clearPushTokenSyncCache: vi.fn(),
  readLastSyncedExpoToken: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/pending-revokes', () => ({
  enqueuePendingRevoke: vi.fn(),
  drainPendingRevokes: vi.fn().mockResolvedValue({ drained: 0, retained: 0 }),
}));

vi.mock('@/lib/last-active-at', () => ({
  clearLastActiveAt: vi.fn(),
}));

vi.mock('@/lib/session-stamp', () => ({
  clearSessionStamp: vi.fn(),
}));

// The global mock in __tests__/setup.ts builds `db` from `createMockDb`,
// which doesn't include `setTenantContext`. Override here so cleanup can
// call it without exploding.
vi.mock('@/lib/supabase', () => ({
  db: { setTenantContext: vi.fn() },
  supabase: {
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  },
}));

import { cleanupClientState } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';

describe('cleanupClientState — realtime teardown (Blocker 2)', () => {
  beforeEach(() => {
    useRealtimeStatusStore.setState({ channels: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('awaits removeChannel for every active realtime channel', async () => {
    const channelA = { __id: 'a' } as never;
    const channelB = { __id: 'b' } as never;
    vi.mocked(supabase.getChannels).mockReturnValue([channelA, channelB]);
    const removeChannel = vi.mocked(supabase.removeChannel).mockResolvedValue('ok' as never);

    await cleanupClientState();

    expect(removeChannel).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenCalledWith(channelA);
    expect(removeChannel).toHaveBeenCalledWith(channelB);
  });

  it('clears the realtime status store so stale badges do not leak across logout', async () => {
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'degraded');
    useRealtimeStatusStore.getState().setChannelStatus('tables:all', 'reconnecting');
    expect(useRealtimeStatusStore.getState().channels).toEqual({
      'orders:all': 'degraded',
      'tables:all': 'reconnecting',
    });

    vi.mocked(supabase.getChannels).mockReturnValue([]);
    await cleanupClientState();

    expect(useRealtimeStatusStore.getState().channels).toEqual({});
  });

  it('does not hang logout when removeChannel never resolves', async () => {
    vi.useFakeTimers();
    const stuckChannel = { __id: 'stuck' } as never;
    vi.mocked(supabase.getChannels).mockReturnValue([stuckChannel]);
    // Simulate a dead WebSocket — removeChannel's leave-ack never arrives.
    vi.mocked(supabase.removeChannel).mockReturnValue(new Promise(() => {}) as never);

    const cleanup = cleanupClientState();
    // The 2s timeout in cleanupClientState fires; the function should resolve
    // shortly after rather than waiting on the dead channel forever.
    await vi.advanceTimersByTimeAsync(2_500);
    await expect(cleanup).resolves.toBeUndefined();
  });

  it('captures errors from removeChannel without aborting cleanup', async () => {
    const goodChannel = { __id: 'good' } as never;
    const badChannel = { __id: 'bad' } as never;
    vi.mocked(supabase.getChannels).mockReturnValue([goodChannel, badChannel]);
    vi.mocked(supabase.removeChannel).mockImplementation((c: unknown) => {
      if ((c as { __id: string }).__id === 'bad') {
        return Promise.reject(new Error('simulated channel teardown failure')) as never;
      }
      return Promise.resolve('ok') as never;
    });

    // Should not throw — bad-channel error is swallowed and reported to Sentry.
    await expect(cleanupClientState()).resolves.toBeUndefined();
  });
});
