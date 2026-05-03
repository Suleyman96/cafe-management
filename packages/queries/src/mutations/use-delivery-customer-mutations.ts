import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateDeliveryCustomer(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone: string; address: string; notes: string | null }) =>
      db.deliveryCustomers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS),
      });
    },
    onError: options?.onError,
  });
}

export function useUpdateDeliveryCustomer(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
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
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS),
      });
    },
    onError: options?.onError,
  });
}

export function useDeleteDeliveryCustomer(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS),
      });
    },
    onError: options?.onError,
  });
}

export function useIncrementDeliveryCustomerOrderCount(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deliveryCustomers.incrementOrderCount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_CUSTOMERS),
      });
    },
    onError: options?.onError,
  });
}
