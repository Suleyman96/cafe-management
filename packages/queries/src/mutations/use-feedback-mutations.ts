import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useMarkFeedbackRead() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.markRead(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
  });
}
