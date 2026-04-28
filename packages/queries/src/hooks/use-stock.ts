import type { StockItem, StockMovement } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useStockItems(options?: Record<string, unknown>) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, options],
    queryFn: () => db.stockItems.findAll(options) as Promise<StockItem[]>,
  });
}

export function useStockItem(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEM, id],
    queryFn: () => db.stockItems.findById(id) as Promise<StockItem>,
    enabled: !!id,
  });
}

export function useStockMovements(stockItemId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_MOVEMENTS, stockItemId],
    queryFn: () => db.stockItems.getMovements(stockItemId) as Promise<StockMovement[]>,
    enabled: !!stockItemId,
  });
}

export function useLowStockCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.LOW_STOCK_COUNT],
    queryFn: () => db.stockItems.getLowStockCount() as Promise<number>,
  });
}
