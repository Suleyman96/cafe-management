import type { OrderWithDetails } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useOrders(filters?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  const { enabled, ...queryFilters } = filters ?? {};
  const filterKey = Object.keys(queryFilters).length > 0 ? queryFilters : undefined;
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS, filterKey),
    queryFn: (): Promise<OrderWithDetails[]> => db.orders.findAll(filterKey),
    enabled: enabled ?? true,
  });
}

export function useOrder(orderId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
    // Asserted, not annotated: findById's `isOrder` guard narrows its static
    // return type to a bare Order, but the underlying select does fetch the
    // table + order_items relations. The cast widens to the real shape.
    queryFn: () => db.orders.findById(orderId) as Promise<OrderWithDetails>,
    enabled: !!orderId && (options?.enabled ?? true),
  });
}

export function useActiveOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
    queryFn: (): Promise<OrderWithDetails[]> => db.orders.getActiveOrders(),
    enabled: options?.enabled ?? true,
  });
}

export function useDeliveryOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS),
    queryFn: (): Promise<OrderWithDetails[]> => db.orders.findDeliveryOrders(),
    enabled: options?.enabled ?? true,
  });
}

export function useTakeoutOrders(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS),
    queryFn: (): Promise<OrderWithDetails[]> => db.orders.findTakeoutOrders(),
    enabled: options?.enabled ?? true,
  });
}
