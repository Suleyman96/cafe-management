import { QUERY_KEYS } from '@gustri/core';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTable, useTables, useUpdateTableStatus } from '@/hooks/use-tables';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useTables());
    expect(mockDb.tables.findAll).toHaveBeenCalled();
  });
});

describe('useTable', () => {
  it('calls db.tables.findById', () => {
    const { mockDb } = renderHookWithProviders(() => useTable('t1'));
    expect(mockDb.tables.findById).toHaveBeenCalledWith('t1');
  });
});

describe('useUpdateTableStatus', () => {
  it('invalidates tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTableStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tables']);
  });
});

// --- New tests using QUERY_KEYS constants, data flow, and argument verification ---

describe('useTables - data flow', () => {
  it('returns fetched tables data', async () => {
    const mockTables = [{ id: 't1', table_number: 'T01', status: 'free' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.tables.findAll as any).mockResolvedValueOnce(mockTables);
    const { result } = renderHook(() => useTables(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockTables));
  });
});

describe('useUpdateTableStatus - argument verification', () => {
  it('calls updateStatus with correct args', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' });
    expect(mockDb.tables.updateStatus).toHaveBeenCalledWith('t1', 'occupied');
  });
});

describe('useUpdateTableStatus - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.TABLES constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTableStatus());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.TABLES]);
  });
});
