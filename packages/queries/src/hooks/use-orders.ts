import type { OrderWithDetails } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useOrders(filters?: Record<string, unknown>) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDERS, filters],
    queryFn: () => db.orders.findAll(filters) as Promise<OrderWithDetails[]>,
  });
}

export function useOrder(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ORDER, orderId],
    queryFn: () => db.orders.findById(orderId) as Promise<OrderWithDetails>,
    enabled: !!orderId,
  });
}

export function useActiveOrders() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.ACTIVE_ORDERS],
    queryFn: () => db.orders.getActiveOrders() as Promise<OrderWithDetails[]>,
  });
}

export function useDeliveryOrders() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_ORDERS],
    queryFn: () => db.orders.findDeliveryOrders() as Promise<OrderWithDetails[]>,
  });
}

export function useTakeoutOrders() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TAKEOUT_ORDERS],
    queryFn: () => db.orders.findTakeoutOrders() as Promise<OrderWithDetails[]>,
  });
}
