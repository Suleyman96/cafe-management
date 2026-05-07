/**
 * Mobile audit #3 — degraded-transition catchup.
 *
 * When the realtime channel exhausts retries and flips to `degraded`,
 * `useOrders` must force a fresh refetch of the orders list at the
 * transition edge so the kitchen sound for any orders that arrived during
 * the disconnect plays as soon as the network returns the new data —
 * rather than waiting for the next 20s safety-net poll tick (which is the
 * pre-fix gap the audit calls out).
 *
 * The contract under test: a transition `connected` → `degraded` on
 * channelName `orders:all` triggers an additional `db.orders.findAll`
 * call beyond the initial mount fetch. The diff against
 * `knownOrderIdsRef` and the actual sound playback are exercised by the
 * existing realtime-handler tests; here we only assert the refetch edge.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/notifications', () => ({
  notifyNewOrder: vi.fn(),
  notifyWaiterCall: vi.fn(),
  notifyOrderReady: vi.fn(),
}));

vi.mock('@/lib/sound', () => ({
  playNewOrderSound: vi.fn(),
  playWaiterCallSound: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  hapticEvent: vi.fn(),
}));

import { useOrders } from '@/hooks/use-orders';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';
import { createWrapper } from '../helpers/test-utils';

describe('useOrders — degraded-transition catchup (audit #3)', () => {
  it('forces a refetch on transition to degraded', async () => {
    // Reset the realtime status store so we control the transition edge.
    useRealtimeStatusStore.getState().removeChannel('orders:all');

    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValue([{ id: 'o1', status: 'new' }]);

    const { result } = renderHook(() => useOrders(), { wrapper });

    // Wait for the initial fetch to settle so the next call is unambiguously
    // the transition-driven refetch.
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'o1', status: 'new' }]));
    const callsBefore = (mockDb.orders.findAll as any).mock.calls.length;

    // Simulate the realtime sync hook flipping to `degraded` after exhausting
    // retries. The hook subscribes to this exact key.
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'degraded');

    await waitFor(() => {
      expect((mockDb.orders.findAll as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('does not refetch on transitions that are not the degraded edge', async () => {
    useRealtimeStatusStore.getState().removeChannel('orders:all');

    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValue([]);

    renderHook(() => useOrders(), { wrapper });

    await waitFor(() => {
      expect((mockDb.orders.findAll as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    const callsBefore = (mockDb.orders.findAll as any).mock.calls.length;

    // `connected` and `reconnecting` are healthy/transient states. Neither
    // should trigger a manual refetch on top of the realtime/poll path.
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'connected');
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'reconnecting');

    // Give effect dispatchers a chance to run — but expect no additional
    // call. 50ms is a generous floor for React's effect scheduling.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((mockDb.orders.findAll as any).mock.calls.length).toBe(callsBefore);
  });

  it('only fires once per transition edge (no spam on staying degraded)', async () => {
    useRealtimeStatusStore.getState().removeChannel('orders:all');

    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValue([]);

    renderHook(() => useOrders(), { wrapper });
    await waitFor(() => {
      expect((mockDb.orders.findAll as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    const callsBefore = (mockDb.orders.findAll as any).mock.calls.length;

    // First transition into degraded — this fires the audit-#3 refetch.
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'degraded');
    await waitFor(() => {
      expect((mockDb.orders.findAll as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
    const callsAfterFirstTransition = (mockDb.orders.findAll as any).mock.calls.length;

    // Re-set to degraded (e.g. status emitter being chatty). No new transition
    // edge → no new refetch.
    useRealtimeStatusStore.getState().setChannelStatus('orders:all', 'degraded');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((mockDb.orders.findAll as any).mock.calls.length).toBe(callsAfterFirstTransition);
  });
});
