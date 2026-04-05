/**
 * Type-Safe Feedback Hooks
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type CustomerFeedback = Database['public']['Tables']['customer_feedback']['Row'];

export function useFeedback(status?: 'pending' | 'acknowledged') {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, status],
    queryFn: async (): Promise<CustomerFeedback[]> => db.feedback.findAll(status),
  });
}

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, 'count', 'pending'],
    queryFn: async (): Promise<number> => db.feedback.getPendingCount(),
    refetchInterval: 30000,
  });
}

export function useMarkFeedbackRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, staffId }: { feedbackId: string; staffId: string }) =>
      db.feedback.markRead(feedbackId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
    },
  });
}

export function getFeedbackTypeInfo(type: string): { icon: string; label: string; color: string } {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    complaint: { icon: '😟', label: 'Complaint', color: 'red' },
    praise: { icon: '😊', label: 'Praise', color: 'green' },
  };

  return types[type] || { icon: '📝', label: 'Feedback', color: 'gray' };
}
