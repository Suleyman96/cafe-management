import type { StaffInsert, StaffUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateStaff(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffInsert) => db.staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF) });
    },
    onError: options?.onError,
  });
}

export function useUpdateStaff(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StaffUpdate }) =>
      db.staff.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF) });
    },
    onError: options?.onError,
  });
}

export function useDeleteStaff(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF) });
    },
    onError: options?.onError,
  });
}
