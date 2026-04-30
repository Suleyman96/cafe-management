import type { StockItem, StockMovement } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useStockItems(options?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const { enabled, ...filters } = options ?? {};
  const filterKey = Object.keys(filters).length > 0 ? filters : undefined;
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, filterKey],
    queryFn: () => db.stockItems.findAll(filterKey) as Promise<StockItem[]>,
    enabled: enabled ?? true,
  });
}

export function useStockItem(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEM, id],
    queryFn: () => db.stockItems.findById(id) as Promise<StockItem>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useStockMovements(stockItemId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_MOVEMENTS, stockItemId],
    queryFn: () => db.stockItems.getMovements(stockItemId) as Promise<StockMovement[]>,
    enabled: !!stockItemId && (options?.enabled ?? true),
  });
}

export function useLowStockCount(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.LOW_STOCK_COUNT],
    queryFn: () => db.stockItems.getLowStockCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}
