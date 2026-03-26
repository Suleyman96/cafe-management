import { QUERY_KEYS } from '@cafe-idare/core';
import { useCallWaiter, useCreateWaiterCall, useWaiterCalls } from '@/hooks/use-waiter-call';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls db.waiterCalls.findByTable with tableId and pending status', () => {
    renderHookWithProviders(() => useWaiterCalls('table-1'));
    expect(db.waiterCalls.findByTable).toHaveBeenCalledWith('table-1', 'pending');
  });
});

describe('useCreateWaiterCall', () => {
  it('calls db.waiterCalls.create with correct fields', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'assistance',
      reason: 'Need help',
      priority: 'normal',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      call_type: 'assistance',
      reason: 'Need help',
      priority: 'normal',
    });
  });

  it('uses notes as reason when notes is provided', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'bill',
      reason: 'Default reason',
      priority: 'high',
      notes: 'Custom note',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Custom note',
      }),
    );
  });

  it('uses reason when notes is empty string', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'question',
      reason: 'Original reason',
      priority: 'low',
      notes: '',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Original reason',
      }),
    );
  });

  it('invalidates WAITER_CALLS scoped to tableId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWaiterCall());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'assistance',
      reason: 'Help',
      priority: 'normal',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.WAITER_CALLS, 'table-1']);
  });
});

describe('useCallWaiter', () => {
  it('is an alias for useCreateWaiterCall', () => {
    expect(useCallWaiter).toBe(useCreateWaiterCall);
  });
});
