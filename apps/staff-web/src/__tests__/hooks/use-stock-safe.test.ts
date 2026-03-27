import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useAdjustStock,
  useCreateStockItem,
  useDeleteStockItem,
  useLowStockCount,
  useStockItem,
  useStockItems,
  useStockMovements,
  useUpdateStockItem,
} from '@/hooks/use-stock-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useStockItems', () => {
  it('calls db.stockItems.findAll', () => {
    renderHookWithProviders(() => useStockItems());
    expect(db.stockItems.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { category: 'food', lowStockOnly: true };
    renderHookWithProviders(() => useStockItems(opts));
    expect(db.stockItems.findAll).toHaveBeenCalledWith(opts);
  });

  it('returns fetched stock items', async () => {
    const mockItems = [{ id: 'si1', name: 'Coffee', quantity: 50 }];
    (db.stockItems.findAll as any).mockResolvedValueOnce(mockItems);
    const { result } = renderHookWithProviders(() => useStockItems());
    await waitFor(() => expect(result.current.data).toEqual(mockItems));
  });

  it('reports error when findAll rejects', async () => {
    (db.stockItems.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHookWithProviders(() => useStockItems());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useStockItem', () => {
  it('calls findById', () => {
    renderHookWithProviders(() => useStockItem('s1'));
    expect(db.stockItems.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useStockItem(''));
    expect(db.stockItems.findById).not.toHaveBeenCalled();
  });
});

describe('useStockMovements', () => {
  it('calls getMovements with stockItemId', () => {
    renderHookWithProviders(() => useStockMovements('s1'));
    expect(db.stockItems.getMovements).toHaveBeenCalledWith('s1');
  });

  it('is disabled when stockItemId is empty', () => {
    renderHookWithProviders(() => useStockMovements(''));
    expect(db.stockItems.getMovements).not.toHaveBeenCalled();
  });
});

describe('useLowStockCount', () => {
  it('calls getLowStockCount', () => {
    renderHookWithProviders(() => useLowStockCount());
    expect(db.stockItems.getLowStockCount).toHaveBeenCalled();
  });
});

describe('useCreateStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Tomatoes' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });
});

describe('useUpdateStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', updates: { name: 'Updated' } });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });
});

describe('useDeleteStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('s1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });
});

describe('useAdjustStock', () => {
  it('invalidates STOCK_ITEMS, STOCK_MOVEMENTS, and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAdjustStock());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      id: 's1',
      data: { type: 'out', quantity: 5, reason: 'Used' },
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_MOVEMENTS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });

  it('calls adjustStock with correct args', async () => {
    const { result } = renderHookWithProviders(() => useAdjustStock());
    const data = { id: 'si1', data: { type: 'in' as const, quantity: 10, reason: 'restock' } };
    await result.current.mutateAsync(data);
    expect(db.stockItems.adjustStock).toHaveBeenCalledWith('si1', data.data);
  });
});
