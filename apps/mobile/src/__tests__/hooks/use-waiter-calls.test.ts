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

import { useUpdateWaiterCall, useWaiterCalls } from '@/hooks/use-waiter-calls';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls db.waiterCalls.findAll', () => {
    renderHookWithProviders(() => useWaiterCalls());
    expect(db.waiterCalls.findAll).toHaveBeenCalled();
  });
});

describe('useUpdateWaiterCall', () => {
  it('invalidates waiter_calls on acknowledge', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWaiterCall());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', status: 'acknowledged', staffId: 's1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['waiter_calls']);
  });

  it('invalidates waiter_calls on resolve', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWaiterCall());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', status: 'resolved' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['waiter_calls']);
  });
});
