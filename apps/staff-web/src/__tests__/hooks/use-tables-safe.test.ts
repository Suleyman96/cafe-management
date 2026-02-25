import { QUERY_KEYS } from '@cafe-idare/core';
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
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    renderHookWithProviders(() => useTables());
    expect(db.tables.findAll).toHaveBeenCalled();
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
});

describe('useCreateTable', () => {
  it('invalidates TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ table_number: '5', capacity: 4, status: 'free' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
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
});
