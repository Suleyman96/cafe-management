import { QUERY_KEYS } from '@gustri/core';
import { useCallWaiter, useCreateWaiterCall, useWaiterCalls } from '@/hooks/use-waiter-call';
import { db, supabase } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls supabase.rpc with get_waiter_calls_for_table', () => {
    renderHookWithProviders(() => useWaiterCalls('table-1'));
    expect(supabase.rpc).toHaveBeenCalledWith('get_waiter_calls_for_table', {
      p_table_id: 'table-1',
      p_status: 'pending',
    });
  });

  it('returns fetched waiter calls', async () => {
    const mockCalls = [
      { id: 'wc1', table_id: 'table-1', call_type: 'assistance', status: 'pending' },
    ];
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockCalls, error: null });

    const { result } = renderHookWithProviders(() => useWaiterCalls('table-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCalls);
  });

  it('reports error when fetch fails', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: new Error('DB error') });

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
      tenantId: 'tenant-1',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      tenant_id: 'tenant-1',
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
      tenantId: 'tenant-1',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      tenant_id: 'tenant-1',
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
      tenantId: 'tenant-1',
    });

    expect(db.waiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      tenant_id: 'tenant-1',
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
      tenantId: 'tenant-1',
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
        tenantId: 'tenant-1',
      }),
    ).rejects.toThrow('Create failed');
  });
});

describe('useCallWaiter', () => {
  it('is an alias for useCreateWaiterCall', () => {
    expect(useCallWaiter).toBe(useCreateWaiterCall);
  });
});
