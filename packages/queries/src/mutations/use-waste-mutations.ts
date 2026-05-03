import type { WasteLogInsert, WasteLogUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateWaste } from '../invalidation';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateWasteLog(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WasteLogInsert) => db.waste.create(data),
    onSuccess: () => {
      invalidateWaste(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateWasteLog(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<WasteLogUpdate> }) =>
      db.waste.update(id, updates),
    onSuccess: () => {
      invalidateWaste(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteWasteLog(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.waste.delete(id),
    onSuccess: () => {
      invalidateWaste(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
