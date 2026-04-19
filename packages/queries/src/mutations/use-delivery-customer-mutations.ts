import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useCreateDeliveryCustomer() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone: string; address: string; notes?: string | null }) =>
      db.deliveryCustomers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useUpdateDeliveryCustomer() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { name?: string; phone?: string; address?: string; notes?: string | null };
    }) => db.deliveryCustomers.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useDeleteDeliveryCustomer() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}

export function useIncrementDeliveryCustomerOrderCount() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.incrementOrderCount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_CUSTOMERS] });
    },
  });
}
