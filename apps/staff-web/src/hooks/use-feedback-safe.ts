/**
 * Type-Safe Feedback Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type FeedbackStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export function useFeedback(status?: FeedbackStatus) {
  return useQuery({
    queryKey: ['feedback', status],
    queryFn: () => db.feedback.findAll(status),
  });
}

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: ['feedback-count', 'pending'],
    queryFn: () => db.feedback.getPendingCount(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, staffId }: { feedbackId: string; staffId: string }) =>
      db.feedback.acknowledge(feedbackId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-count'] });
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
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-count'] });
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackId: string) => db.feedback.dismiss(feedbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-count'] });
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
