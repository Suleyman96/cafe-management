import type { DeliveryCustomer } from '@gustri/database';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useDeliveryCustomers(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS),
    queryFn: () => db.deliveryCustomers.findAll() as Promise<DeliveryCustomer[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useDeliveryCustomersPaginated(
  page: number,
  pageSize: number,
  search?: string,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(
      tenantId,
      QUERY_KEYS.DELIVERY_CUSTOMERS,
      'paginated',
      page,
      pageSize,
      search,
    ),
    queryFn: () => db.deliveryCustomers.findAllPaginated({ page, pageSize, search }),
    // Show the previous page while the next one is loading instead of a
    // spinner — material on high-RTT clients where each fetch is ~300ms.
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useSearchDeliveryCustomers(query: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS, 'search', query),
    queryFn: () => db.deliveryCustomers.search(query) as Promise<DeliveryCustomer[]>,
    enabled: !!query && (options?.enabled ?? true),
  });
}
