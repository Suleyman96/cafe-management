import { QUERY_KEYS } from '@gustri/core';
import { useCallWaiter, useCreateWaiterCall, useWaiterCalls } from '@/hooks/use-waiter-call';
import { db } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls db.waiterCalls.findByTable with tableId and pending status', () => {
    renderHookWithProviders(() => useWaiterCalls('table-1'));
    expect(db.waiterCalls.findByTable).toHaveBeenCalledWith('table-1', 'pending');
  });

  it('returns fetched waiter calls', async () => {
    const mockCalls = [
      { id: 'wc1', table_id: 'table-1', call_type: 'assistance', status: 'pending' },
    ];
    (db.waiterCalls.findByTable as any).mockResolvedValueOnce(mockCalls);

    const { result } = renderHookWithProviders(() => useWaiterCalls('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCalls);
  });

  it('reports error when fetch fails', async () => {
    (db.waiterCalls.findByTable as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHookWithProviders(() => useWaiterCalls('table-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
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

  it('passes notes separately when provided', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'bill',
      reason: 'Default reason',
      priority: 'high',
      notes: 'Custom note',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      call_type: 'bill',
      reason: 'Default reason',
      priority: 'high',
      notes: 'Custom note',
    });
  });

  it('does not include notes when empty string', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'question',
      reason: 'Original reason',
      priority: 'low',
      notes: '',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      call_type: 'question',
      reason: 'Original reason',
      priority: 'low',
    });
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

describe('useCreateWaiterCall - error handling', () => {
  it('rejects when db.waiterCalls.create fails', async () => {
    (db.waiterCalls.create as any).mockRejectedValueOnce(new Error('Create failed'));

    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await expect(
      result.current.mutateAsync({
        tableId: 'table-1',
        callType: 'assistance',
        reason: 'Help',
        priority: 'normal',
      }),
    ).rejects.toThrow('Create failed');
  });
});

describe('useCallWaiter', () => {
  it('is an alias for useCreateWaiterCall', () => {
    expect(useCallWaiter).toBe(useCreateWaiterCall);
  });
});
