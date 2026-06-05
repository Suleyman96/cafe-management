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

  // ADD-5 optimistic updates
  it('optimistically flips the call to acknowledged before the network resolves', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWaiterCall());
    queryClient.setQueryData(
      ['waiter_calls'],
      [
        { id: 'c1', status: 'pending', responded_by: null, acknowledged_at: null },
        { id: 'c2', status: 'pending', responded_by: null, acknowledged_at: null },
      ],
    );
    let cached: any[] | undefined;
    (db.waiterCalls.acknowledge as any).mockImplementationOnce(async () => {
      cached = queryClient.getQueryData(['waiter_calls']);
      return { id: 'c1' };
    });

    await result.current.mutateAsync({ callId: 'c1', status: 'acknowledged', staffId: 's1' });

    const c1 = cached?.find((c) => c.id === 'c1');
    expect(c1?.status).toBe('acknowledged');
    expect(c1?.responded_by).toBe('s1');
    expect(cached?.find((c) => c.id === 'c2')?.status).toBe('pending');
  });

  it('rolls back the optimistic acknowledge on error', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWaiterCall());
    queryClient.setQueryData(['waiter_calls'], [{ id: 'c1', status: 'pending' }]);
    (db.waiterCalls.acknowledge as any).mockRejectedValueOnce(new Error('contended'));

    await expect(
      result.current.mutateAsync({ callId: 'c1', status: 'acknowledged', staffId: 's1' }),
    ).rejects.toThrow('contended');

    expect(
      (queryClient.getQueryData(['waiter_calls']) as any[]).find((c) => c.id === 'c1').status,
    ).toBe('pending');
  });
});
