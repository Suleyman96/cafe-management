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

export function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.acknowledge(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
    onError: (error: Error) => {
      console.error('Failed to acknowledge feedback:', error.message);
    },
  });
}

export function useRespondToFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      staffId,
      response,
      status,
    }: {
      id: string;
      staffId: string;
      response: string;
      status?: CustomerFeedback['status'];
    }) => db.feedback.respond(id, staffId, response, status ?? 'acknowledged'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
    onError: (error: Error) => {
      console.error('Failed to respond to feedback:', error.message);
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.feedback.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
    onError: (error: Error) => {
      console.error('Failed to dismiss feedback:', error.message);
    },
  });
}
