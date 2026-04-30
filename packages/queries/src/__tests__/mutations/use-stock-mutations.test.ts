import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '../../keys';
import {
  useCreateStockItem,
  useDeleteStockItem,
  useUpdateStockItem,
} from '../../mutations/use-stock-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useCreateStockItem', () => {
  it('calls db.stockItems.create', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateStockItem());
    const data = { name: 'flour', unit: 'kg' } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.stockItems.create).toHaveBeenCalledWith(data);
  });

  it('invalidates stock items + low stock count', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStockItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
    expect(keys).toContainEqual([QUERY_KEYS.LOW_STOCK_COUNT]);
  });
});

describe('useUpdateStockItem', () => {
  it('forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateStockItem());
    await result.current.mutateAsync({ id: 's1', updates: { quantity: 10 } });
    expect(mockDb.stockItems.update).toHaveBeenCalledWith('s1', { quantity: 10 });
  });
});

describe('useDeleteStockItem', () => {
  it('forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteStockItem());
    await result.current.mutateAsync('s1');
    expect(mockDb.stockItems.delete).toHaveBeenCalledWith('s1');
  });

  it('propagates errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteStockItem());
    (mockDb.stockItems.delete as any).mockRejectedValueOnce(new Error('FK'));
    await expect(result.current.mutateAsync('s1')).rejects.toThrow('FK');
  });
});
