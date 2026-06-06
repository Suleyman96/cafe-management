/**
 * `useRealtimeSync` — channel lifecycle + status-store contract.
 *
 * This is the most complex stateful mobile hook and had no direct tests, which
 * is how audit #5 (the shared `'orders:all'` channel-name collision) slipped
 * through. The key regression guard here is
 * "unmounting one channel leaves a sibling's status intact" — with the old
 * hardcoded name, two consumers shared one status-store key and unmounting one
 * ran `removeChannel` on the key the other still needed.
 *
 * The Supabase client is mocked globally in `setup.ts`; here we override
 * `supabase.channel` with a controllable fake so we can drive the subscribe
 * status callback and the postgres_changes handler synchronously.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { supabase } from '@/lib/supabase';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';
import { createWrapper } from '../helpers/test-utils';

type FakeChannel = {
  name: string;
  /** postgres_changes callbacks registered via `.on(...)`, in order. */
  onCallbacks: Array<(payload: Record<string, unknown>) => void | Promise<void>>;
  /** the `subscribe(status => …)` callback the hook installs. */
  statusCb?: (status: string) => void;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

/**
 * Replace `supabase.channel` with a fake that records every channel by name
 * and exposes hooks to fire its status + postgres callbacks. Returns the
 * name→channel registry.
 */
function installRealtimeMock(): Map<string, FakeChannel> {
  const channels = new Map<string, FakeChannel>();
  vi.mocked(supabase.channel).mockImplementation(((name: string) => {
    const chan: FakeChannel = {
      name,
      onCallbacks: [],
      on: vi.fn((_type: string, _opts: unknown, cb: (p: Record<string, unknown>) => void) => {
        chan.onCallbacks.push(cb);
        return chan;
      }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        chan.statusCb = cb;
        return chan;
      }),
      unsubscribe: vi.fn(async () => {}),
    };
    channels.set(name, chan);
    return chan as unknown as ReturnType<typeof supabase.channel>;
  }) as unknown as typeof supabase.channel);
  vi.mocked(supabase.removeChannel).mockResolvedValue('ok' as never);
  return channels;
}

const ORDERS_HANDLER = [{ table: 'orders', event: '*' as const, queryKeys: [] as string[][] }];

beforeEach(() => {
  useRealtimeStatusStore.getState().clearAll();
});

afterEach(() => {
  useRealtimeStatusStore.getState().clearAll();
});

describe('useRealtimeSync', () => {
  it('subscribes to a Supabase channel under the given name', () => {
    installRealtimeMock();
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('chan-A', ORDERS_HANDLER), { wrapper });
    expect(supabase.channel).toHaveBeenCalledWith('chan-A');
  });

  it('writes "connected" to the status store under that name on SUBSCRIBED', () => {
    const channels = installRealtimeMock();
    const { wrapper } = createWrapper();
    renderHook(() => useRealtimeSync('chan-A', ORDERS_HANDLER), { wrapper });

    act(() => channels.get('chan-A')?.statusCb?.('SUBSCRIBED'));

    expect(useRealtimeStatusStore.getState().channels['chan-A']).toBe('connected');
  });

  // Audit #5 regression guard — the precise scenario the old shared-name bug
  // produced. Two channels are live; tearing one down must not evict the
  // other's status-store entry (which would silence its consumer).
  it('unmounting one channel leaves a sibling channel status intact', () => {
    const channels = installRealtimeMock();
    const { wrapper } = createWrapper();

    const a = renderHook(() => useRealtimeSync('chan-A', ORDERS_HANDLER), { wrapper });
    const b = renderHook(() => useRealtimeSync('chan-B', ORDERS_HANDLER), { wrapper });

    act(() => channels.get('chan-A')?.statusCb?.('SUBSCRIBED'));
    act(() => channels.get('chan-B')?.statusCb?.('SUBSCRIBED'));
    expect(useRealtimeStatusStore.getState().channels).toEqual({
      'chan-A': 'connected',
      'chan-B': 'connected',
    });

    a.unmount();

    expect(useRealtimeStatusStore.getState().channels['chan-A']).toBeUndefined();
    expect(useRealtimeStatusStore.getState().channels['chan-B']).toBe('connected');

    b.unmount();
  });

  it('invalidates the handler queryKeys when a matching event arrives', async () => {
    const channels = installRealtimeMock();
    const { wrapper, queryClient } = createWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () =>
        useRealtimeSync('chan-A', [{ table: 'orders', event: 'INSERT', queryKeys: [['orders']] }]),
      { wrapper },
    );

    const chan = channels.get('chan-A');
    await act(async () => {
      await chan?.onCallbacks[0]?.({ new: { id: 'o1' }, eventType: 'INSERT' });
    });

    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
      expect(keys).toContainEqual(['orders']);
    });
  });

  it('removes its status entry on unmount', () => {
    const channels = installRealtimeMock();
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useRealtimeSync('chan-A', ORDERS_HANDLER), { wrapper });

    act(() => channels.get('chan-A')?.statusCb?.('SUBSCRIBED'));
    expect(useRealtimeStatusStore.getState().channels['chan-A']).toBe('connected');

    unmount();
    expect(useRealtimeStatusStore.getState().channels['chan-A']).toBeUndefined();
  });
});
