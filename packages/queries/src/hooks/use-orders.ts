import type { OrderWithDetails } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useOrders(filters?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const { enabled, ...queryFilters } = filters ?? {};
  const filterKey = Object.keys(queryFilters).length > 0 ? queryFilters : undefined;
  return useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filterKey],
    queryFn: () => db.orders.findAll(filterKey) as Promise<OrderWithDetails[]>,
    enabled: enabled ?? true,
  });
}

export function useOrder(orderId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: () => db.orders.findById(orderId) as Promise<OrderWithDetails>,
    enabled: !!orderId && (options?.enabled ?? true),
  });
}

export function useActiveOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ACTIVE_ORDERS],
    queryFn: () => db.orders.getActiveOrders() as Promise<OrderWithDetails[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useDeliveryOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDERS],
    queryFn: () => db.orders.findDeliveryOrders() as Promise<OrderWithDetails[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useTakeoutOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TAKEOUT_ORDERS],
    queryFn: () => db.orders.findTakeoutOrders() as Promise<OrderWithDetails[]>,
    enabled: options?.enabled ?? true,
  });
}
