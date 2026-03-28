import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateTable,
  useDeleteTable,
  useTable,
  useTableByQrCode,
  useTables,
  useUpdateTable,
  useUpdateTableStatus,
} from '@/hooks/use-tables-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    renderHookWithProviders(() => useTables());
    expect(db.tables.findAll).toHaveBeenCalled();
  });

  it('returns fetched tables data', async () => {
    const mockTables = [{ id: 't1', table_number: 'T01', status: 'free' }];
    (db.tables.findAll as any).mockResolvedValueOnce(mockTables);
    const { result } = renderHookWithProviders(() => useTables());
    await waitFor(() => expect(result.current.data).toEqual(mockTables));
  });

  it('reports error when findAll rejects', async () => {
    (db.tables.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHookWithProviders(() => useTables());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTable', () => {
  it('calls findById with id', () => {
    renderHookWithProviders(() => useTable('t1'));
    expect(db.tables.findById).toHaveBeenCalledWith('t1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useTable(''));
    expect(db.tables.findById).not.toHaveBeenCalled();
  });
});

describe('useTableByQrCode', () => {
  it('calls findByQrCode', () => {
    renderHookWithProviders(() => useTableByQrCode('qr-abc'));
    expect(db.tables.findByQrCode).toHaveBeenCalledWith('qr-abc');
  });

  it('is disabled when qrCode is empty', () => {
    renderHookWithProviders(() => useTableByQrCode(''));
    expect(db.tables.findByQrCode).not.toHaveBeenCalled();
  });

  it('useTableByQrCode calls findByQrCode', () => {
    renderHookWithProviders(() => useTableByQrCode('abc123'));
    expect(db.tables.findByQrCode).toHaveBeenCalledWith('abc123');
  });
});

describe('useUpdateTableStatus', () => {
  it('invalidates TABLES and ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTableStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
  });

  it('calls updateStatus with correct args', async () => {
    const { result } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });
    expect(db.tables.updateStatus).toHaveBeenCalledWith('t1', 'occupied');
  });
});

describe('useCreateTable', () => {
  it('invalidates TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ table_number: '5', capacity: 4, status: 'free' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('calls create with table data', async () => {
    const tableData = { table_number: '5', capacity: 4, status: 'free' } as any;
    const { result } = renderHookWithProviders(() => useCreateTable());
    await result.current.mutateAsync(tableData);
    expect(db.tables.create).toHaveBeenCalledWith(tableData);
  });
});

describe('useUpdateTable', () => {
  it('invalidates TABLES and specific TABLE on success', async () => {
    (db.tables.update as any).mockResolvedValueOnce({ id: 't1' });

    const { result, queryClient } = renderHookWithProviders(() => useUpdateTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 't1', updates: { capacity: 6 } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLE, 't1']);
  });
});

describe('useDeleteTable', () => {
  it('invalidates TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('t1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
  });

  it('invalidates TABLE_QR on delete', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync('t1');
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLE_QR]);
  });
});
