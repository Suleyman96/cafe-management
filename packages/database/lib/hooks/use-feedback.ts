/**
 * Customer Feedback Hooks
 * Used by: customer-web, staff-web, mobile-app
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../supabase';
import type { CustomerFeedback, CustomerFeedbackWithTable, FeedbackType, FeedbackStatus } from '../../types';

// ========================================
// Query: Get all feedback (staff only)
// ========================================

export function useFeedback(status?: FeedbackStatus) {
  return useQuery({
    queryKey: ['customer_feedback', status],
    queryFn: async () => {
      let query = getSupabaseClient()
        .from('customer_feedback')
        .select(`
          *,
          table:tables(table_number, location),
          responded_by_staff:staff!responded_by(full_name, role)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CustomerFeedbackWithTable[];
    },
  });
}

// ========================================
// Query: Get feedback for a specific table (customer view)
// ========================================

export function useTableFeedback(tableId: string) {
  return useQuery({
    queryKey: ['customer_feedback', 'table', tableId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('customer_feedback')
        .select('*')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomerFeedback[];
    },
    enabled: !!tableId,
  });
}

// ========================================
// Query: Get pending feedback count
// ========================================

export function usePendingFeedbackCount() {
  return useQuery({
    queryKey: ['customer_feedback', 'pending', 'count'],
    queryFn: async () => {
      const { count, error } = await getSupabaseClient()
        .from('customer_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
  });
}

// ========================================
// Mutation: Submit feedback (customer)
// ========================================

interface CreateFeedbackData {
  table_id?: string;
  order_id?: string;
  feedback_type: FeedbackType;
  subject?: string;
  message: string;
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: CreateFeedbackData) => {
      const { data, error } = await getSupabaseClient()
        .from('customer_feedback')
        .insert({
          ...feedback,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as CustomerFeedback;
    },
    onSuccess: (_, variables) => {
      // Invalidate feedback queries
      queryClient.invalidateQueries({ 
        queryKey: ['customer_feedback'] 
      });
      
      if (variables.table_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['customer_feedback', 'table', variables.table_id] 
        });
      }
    },
  });
}

// ========================================
// Mutation: Acknowledge feedback (staff)
// ========================================

export function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedbackId, staffId }: { feedbackId: string; staffId: string }) => {
      const { data, error } = await getSupabaseClient()
        .from('customer_feedback')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data as CustomerFeedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['customer_feedback'] 
      });
    },
  });
}

// ========================================
// Mutation: Respond to feedback (staff)
// ========================================

interface RespondToFeedbackData {
  feedbackId: string;
  staffId: string;
  response: string;
  status: 'acknowledged' | 'resolved';
}

export function useRespondToFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedbackId, staffId, response, status }: RespondToFeedbackData) => {
      const updates: any = {
        response,
        responded_by: staffId,
        status,
      };

      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { data, error } = await getSupabaseClient()
        .from('customer_feedback')
        .update(updates)
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data as CustomerFeedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['customer_feedback'] 
      });
    },
  });
}

// ========================================
// Mutation: Dismiss feedback (staff)
// ========================================

export function useDismissFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedbackId: string) => {
      const { data, error } = await getSupabaseClient()
        .from('customer_feedback')
        .update({
          status: 'dismissed',
        })
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data as CustomerFeedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['customer_feedback'] 
      });
    },
  });
}

// ========================================
// Helper: Get feedback type display info
// ========================================

export function getFeedbackTypeInfo(type: FeedbackType): { icon: string; label: string; color: string } {
  const typeMap: Record<FeedbackType, { icon: string; label: string; color: string }> = {
    complaint_food: { icon: '🍽️', label: 'Food Issue', color: 'red' },
    complaint_service: { icon: '⚠️', label: 'Service Issue', color: 'orange' },
    complaint_staff: { icon: '👤', label: 'Staff Issue', color: 'red' },
    question_menu: { icon: '❓', label: 'Menu Question', color: 'blue' },
    request_general: { icon: '📝', label: 'General Request', color: 'gray' },
    praise: { icon: '⭐', label: 'Compliment', color: 'green' },
  };

  return typeMap[type] || { icon: '📝', label: type, color: 'gray' };
}

