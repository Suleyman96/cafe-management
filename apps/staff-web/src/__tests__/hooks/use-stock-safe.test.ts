import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
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
import { apiRoutes } from '@/lib/api-routes';
import {
  createWrapper,
  renderHookWithProviders,
  TEST_TENANT_ID,
  waitFor,
} from '../helpers/test-utils';

describe('useStockItems', () => {
  it('calls db.stockItems.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItems());
    expect(mockDb.stockItems.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { category: 'food', lowStockOnly: true };
    const { mockDb } = renderHookWithProviders(() => useStockItems(opts));
    expect(mockDb.stockItems.findAll).toHaveBeenCalledWith(opts);
  });

  it('returns fetched stock items', async () => {
    const mockItems = [{ id: 'si1', name: 'Coffee', quantity: 50 }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.stockItems.findAll as any).mockResolvedValueOnce(mockItems);
    const { result } = renderHook(() => useStockItems(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockItems));
  });

  it('reports error when findAll rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.stockItems.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHook(() => useStockItems(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useStockItem', () => {
  it('calls findById', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItem('s1'));
    expect(mockDb.stockItems.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItem(''));
    expect(mockDb.stockItems.findById).not.toHaveBeenCalled();
  });
});

describe('useStockMovements', () => {
  it('calls getMovements with stockItemId', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements('s1'));
    expect(mockDb.stockItems.getMovements).toHaveBeenCalledWith('s1');
  });

  it('is disabled when stockItemId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements(''));
    expect(mockDb.stockItems.getMovements).not.toHaveBeenCalled();
  });
});

describe('useLowStockCount', () => {
  it('calls getLowStockCount', () => {
    const { mockDb } = renderHookWithProviders(() => useLowStockCount());
    expect(mockDb.stockItems.getLowStockCount).toHaveBeenCalled();
  });
});

describe('useCreateStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Tomatoes' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEMS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.LOW_STOCK_COUNT));
  });
});

describe('useUpdateStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', updates: { name: 'Updated' } });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEMS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.LOW_STOCK_COUNT));
  });
});

describe('useDeleteStockItem', () => {
  it('invalidates STOCK_ITEMS and LOW_STOCK_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStockItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('s1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEMS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.LOW_STOCK_COUNT));
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
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_ITEMS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.STOCK_MOVEMENTS));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.LOW_STOCK_COUNT));
  });

  it('calls apiRoutes.stock.adjust with correct args', async () => {
    const { result } = renderHookWithProviders(() => useAdjustStock());
    const data = { id: 'si1', data: { type: 'in' as const, quantity: 10, reason: 'restock' } };
    await result.current.mutateAsync(data);
    expect(apiRoutes.stock.adjust).toHaveBeenCalledWith('si1', {
      movement_type: 'in',
      quantity_change: 10,
      reason: 'restock',
      performed_by: '',
    });
  });
});
