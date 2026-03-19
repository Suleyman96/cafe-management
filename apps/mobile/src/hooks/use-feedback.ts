import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useFeedback(status?: string) {
  return useQuery({
    queryKey: ['feedback', status],
    queryFn: () => db.feedback.findAll(status as any),
  });
}

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: ['feedback', 'pending-count'],
    queryFn: () => db.feedback.getPendingCount(),
  });
}

export function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      db.feedback.acknowledge(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
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
      status?: string;
    }) => db.feedback.respond(id, staffId, response, status as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.feedback.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
