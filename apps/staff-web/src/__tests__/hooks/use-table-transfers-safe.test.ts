import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import { useOrderTransferHistory, useTransferTable } from '@/hooks/use-table-transfers-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useOrderTransferHistory', () => {
  it('calls db.orders.findById to get transfer history', () => {
    (db.orders.findById as any).mockResolvedValueOnce({ table_transfers: [{ id: 't1' }] });
    renderHookWithProviders(() => useOrderTransferHistory('o1'));
    expect(db.orders.findById).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useOrderTransferHistory(''));
    expect(db.orders.findById).not.toHaveBeenCalled();
  });
});

describe('useTransferTable', () => {
  it('invalidates TABLES, specific TABLEs, ORDERS, ORDER, and table_transfers on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useTransferTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'o1',
      fromTableId: 't1',
      toTableId: 't2',
      staffId: 's1',
      reason: 'customer_request',
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLE, 't1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLE, 't2']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'o1']);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);
    expect(invalidatedKeys).toContainEqual(['table_transfers']);
  });
});
