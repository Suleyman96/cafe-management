/**
 * Type-Safe Feedback Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type CustomerFeedback = Database['public']['Tables']['customer_feedback']['Row'];
type FeedbackStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export function useFeedback(status?: FeedbackStatus) {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, status],
    queryFn: async (): Promise<CustomerFeedback[]> => db.feedback.findAll(status),
  });
}

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, 'count', 'pending'],
    queryFn: async (): Promise<number> => db.feedback.getPendingCount(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, staffId }: { feedbackId: string; staffId: string }) =>
      db.feedback.acknowledge(feedbackId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK, 'count'] });
    },
  });
}

export function useRespondToFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      feedbackId,
      staffId,
      response,
      status,
    }: {
      feedbackId: string;
      staffId: string;
      response: string;
      status: FeedbackStatus;
    }) => db.feedback.respond(feedbackId, staffId, response, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK, 'count'] });
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackId: string) => db.feedback.dismiss(feedbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEEDBACK, 'count'] });
    },
  });
}

// Keep the helper function
export function getFeedbackTypeInfo(type: string): { icon: string; label: string; color: string } {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    complaint_food: { icon: '🍽️', label: 'Food Complaint', color: 'red' },
    complaint_service: { icon: '⚠️', label: 'Service Complaint', color: 'orange' },
    complaint_staff: { icon: '👤', label: 'Staff Complaint', color: 'red' },
    question_menu: { icon: '❓', label: 'Menu Question', color: 'blue' },
    request_general: { icon: '💬', label: 'General Request', color: 'gray' },
    praise: { icon: '⭐', label: 'Praise', color: 'green' },
  };

  return types[type] || { icon: '📝', label: 'Feedback', color: 'gray' };
}
