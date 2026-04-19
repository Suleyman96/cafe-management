import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateWaiterCalls } from '../invalidation';
import { useDb } from '../provider';

export function useAcknowledgeWaiterCall() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.waiterCalls.acknowledge(id, staffId),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
  });
}

export function useResolveWaiterCall() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      db.waiterCalls.resolve(id, notes),
    onSuccess: () => {
      invalidateWaiterCalls(queryClient);
    },
  });
}
