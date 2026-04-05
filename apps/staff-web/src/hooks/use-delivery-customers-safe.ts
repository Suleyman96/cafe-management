/**
 * Type-Safe Delivery Customer Hooks
 */

import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useDeliveryCustomers() {
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS],
    queryFn: () => db.deliveryCustomers.findAll(),
  });
}

export function useSearchDeliveryCustomers(query: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS, 'search', query],
    queryFn: () => db.deliveryCustomers.search(query),
    enabled: query.length >= 2,
  });
}

export function useCreateDeliveryCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; phone: string; address: string; notes?: string | null }) =>
      db.deliveryCustomers.create(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useUpdateDeliveryCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      updates: {
        name?: string;
        phone?: string;
        address?: string;
        notes?: string | null;
      };
    }) => db.deliveryCustomers.update(params.id, params.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useIncrementDeliveryCustomerOrderCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.incrementOrderCount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useDeleteDeliveryCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}
