import { QUERY_KEYS } from '@gustri/queries';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useAdjustStock,
  useCreateStockItem,
  useDeleteStockItem,
  useLowStockCount,
  useStockItems,
  useStockMovements,
  useStockTotalValue,
  useUpdateStockItem,
} from '@/hooks/use-stock';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

describe('useStockItems', () => {
  it('calls db.stockItems.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItems());
    expect(mockDb.stockItems.findAll).toHaveBeenCalled();
  });

  it('passes options', () => {
    const opts = { lowStockOnly: true };
    const { mockDb } = renderHookWithProviders(() => useStockItems(opts));
    expect(mockDb.stockItems.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useLowStockCount', () => {
  it('calls getLowStockCount', () => {
    const { mockDb } = renderHookWithProviders(() => useLowStockCount());
    expect(mockDb.stockItems.getLowStockCount).toHaveBeenCalled();
  });
});

describe('useStockTotalValue', () => {
  it('calls getTotalValue', () => {
    const { mockDb } = renderHookWithProviders(() => useStockTotalValue());
    expect(mockDb.stockItems.getTotalValue).toHaveBeenCalled();
  });
});

describe('useStockMovements', () => {
  it('calls getMovements when itemId is provided', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements('item-1'));
    expect(mockDb.stockItems.getMovements).toHaveBeenCalledWith('item-1');
  });

  it('is disabled when itemId is undefined', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements(undefined));
    expect(mockDb.stockItems.getMovements).not.toHaveBeenCalled();
  });
});

describe('useAdjustStock', () => {
  it('invalidates stock-items and stock-movements on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAdjustStock());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      id: '00000000-0000-0000-0000-0000000000a1',
      data: { type: 'in' as const, quantity: 10, reason: 'restock' },
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['stock_items']);
    expect(keys).toContainEqual(['stock_movements']);
  });
});

describe('useCreateStockItem', () => {
  it('invalidates stock-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Coffee beans' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['stock_items']);
  });
});

describe('useUpdateStockItem', () => {
  it('invalidates stock-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'item-1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['stock_items']);
  });
});

describe('useDeleteStockItem', () => {
  it('invalidates stock-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('item-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['stock_items']);
  });
});

// --- New tests using QUERY_KEYS constants, data flow, and error handling ---

describe('useStockItems - data flow', () => {
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

describe('useAdjustStock - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.STOCK_ITEMS and QUERY_KEYS.STOCK_MOVEMENTS constants', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAdjustStock());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      id: '00000000-0000-0000-0000-0000000000a1',
      data: { type: 'in' as const, quantity: 10, reason: 'restock' },
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_MOVEMENTS]);
  });
});

describe('useCreateStockItem - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.STOCK_ITEMS constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Coffee beans' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });
});

describe('useUpdateStockItem - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.STOCK_ITEMS constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'item-1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });
});

describe('useDeleteStockItem - QUERY_KEYS', () => {
  it('invalidates using QUERY_KEYS.STOCK_ITEMS constant', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('item-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });
});
