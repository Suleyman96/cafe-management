import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS, tenantKey } from '../../keys';
import {
  useCreateTable,
  useDeleteTable,
  useTransferTable,
  useUpdateTable,
  useUpdateTableStatus,
} from '../../mutations/use-table-mutations';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useUpdateTableStatus', () => {
  it('calls db.tables.updateStatus with correct args', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ id: 't1', status: 'occupied' });
    expect(mockDb.tables.updateStatus).toHaveBeenCalledWith('t1', 'occupied');
  });

  it('invalidates tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTableStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 't1', status: 'free' });
    expect(getInvalidatedKeys(spy)).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('propagates errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTableStatus());
    (mockDb.tables.updateStatus as any).mockRejectedValueOnce(new Error('nope'));
    await expect(result.current.mutateAsync({ id: 't1', status: 'free' })).rejects.toThrow('nope');
  });
});

describe('useCreateTable', () => {
  it('calls db.tables.create with the data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateTable());
    const data = { table_number: 7, capacity: 4 } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.tables.create).toHaveBeenCalledWith(data);
  });

  it('invalidates tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});

describe('useUpdateTable', () => {
  it('calls db.tables.update with id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTable());
    const updates = { capacity: 6 } as any;
    await result.current.mutateAsync({ id: 't1', updates });
    expect(mockDb.tables.update).toHaveBeenCalledWith('t1', updates);
  });

  it('invalidates tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 't1', updates: {} as any });
    expect(getInvalidatedKeys(spy)).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});

describe('useDeleteTable', () => {
  it('calls db.tables.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteTable());
    await result.current.mutateAsync('t1');
    expect(mockDb.tables.delete).toHaveBeenCalledWith('t1');
  });

  it('propagates delete errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteTable());
    (mockDb.tables.delete as any).mockRejectedValueOnce(new Error('FK'));
    await expect(result.current.mutateAsync('t1')).rejects.toThrow('FK');
  });
});

describe('useTransferTable', () => {
  it('calls db.rpc.transferTable with the full param shape', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useTransferTable());
    const params = {
      orderId: 'o1',
      fromTableId: 't1',
      toTableId: 't2',
      staffId: 's1',
      reason: 'customer_request',
    };
    await result.current.mutateAsync(params);
    expect(mockDb.rpc.transferTable).toHaveBeenCalledWith(params);
  });

  it('invalidates both tables, the order, and the transfers audit on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useTransferTable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'o1',
      fromTableId: 't1',
      toTableId: 't2',
      staffId: 's1',
    });

    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLE, 't1'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLE, 't2'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'o1'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'table_transfers'));
  });

  it('propagates rpc errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useTransferTable());
    (mockDb.rpc.transferTable as any).mockRejectedValueOnce(new Error('rpc failed'));
    await expect(
      result.current.mutateAsync({
        orderId: 'o1',
        fromTableId: 't1',
        toTableId: 't2',
        staffId: 's1',
      }),
    ).rejects.toThrow('rpc failed');
  });
});
