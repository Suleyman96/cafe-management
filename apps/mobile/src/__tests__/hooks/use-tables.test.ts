import { describe, expect, it, vi } from 'vitest';
import { useTable, useTables, useUpdateTableStatus } from '@/hooks/use-tables';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    renderHookWithProviders(() => useTables());
    expect(db.tables.findAll).toHaveBeenCalled();
  });
});

describe('useTable', () => {
  it('calls db.tables.findById', () => {
    renderHookWithProviders(() => useTable('t1'));
    expect(db.tables.findById).toHaveBeenCalledWith('t1');
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
