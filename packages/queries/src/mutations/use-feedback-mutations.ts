import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useMarkFeedbackRead(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.markRead(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.FEEDBACK) });
    },
    onError: options?.onError,
  });
}
