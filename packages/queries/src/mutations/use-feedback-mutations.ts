import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useMarkFeedbackRead(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.markRead(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
    onError: options?.onError,
  });
}
