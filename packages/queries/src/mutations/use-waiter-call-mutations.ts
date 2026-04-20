import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateWaiterCalls } from '../invalidation';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useAcknowledgeWaiterCall(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.waiterCalls.acknowledge(id, staffId),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
    onError: options?.onError,
  });
}

export function useResolveWaiterCall(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      db.waiterCalls.resolve(id, notes),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
    onError: options?.onError,
  });
}
