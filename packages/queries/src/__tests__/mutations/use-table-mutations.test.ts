import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateTable,
  useDeleteTable,
  useUpdateTable,
  useUpdateTableStatus,
} from '../../mutations/use-table-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

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
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.TABLES]);
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
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.TABLES]);
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
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.TABLES]);
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
