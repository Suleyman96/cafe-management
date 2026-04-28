import { QUERY_KEYS } from '@gustri/queries';
import { useCreateWaiterCall } from '@/hooks/use-waiter-call';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

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
