import { QUERY_KEYS } from '@gustri/core';
import type { DeliveryCustomer } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useDeliveryCustomers() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS],
    queryFn: () => db.deliveryCustomers.findAll() as Promise<DeliveryCustomer[]>,
  });
}

export function useDeliveryCustomersPaginated(page: number, pageSize: number, search?: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS, 'paginated', page, pageSize, search],
    queryFn: () => db.deliveryCustomers.findAllPaginated({ page, pageSize, search }),
  });
}

export function useSearchDeliveryCustomers(query: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS, 'search', query],
    queryFn: () => db.deliveryCustomers.search(query) as Promise<DeliveryCustomer[]>,
    enabled: !!query,
  });
}
