import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { CustomerFeedback } from '@/types';

export function useFeedback(status?: CustomerFeedback['status']) {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, status],
    queryFn: async (): Promise<CustomerFeedback[]> => db.feedback.findAll(status),
  });
}

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, 'pending-count'],
    queryFn: async (): Promise<number> => db.feedback.getPendingCount(),
  });
}

export function useMarkFeedbackRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.markRead(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark feedback as read:', error.message);
    },
  });
}
