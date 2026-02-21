/**
 * Customer feedback wrapper module
 */

import { handleSupabaseError, isCustomerFeedback } from '@cafe-idare/core';
import type { CustomerFeedbackRow, WrapperContext } from './types';

export function createFeedbackWrapper(ctx: WrapperContext) {
  return {
    findAll: async (status?: CustomerFeedbackRow['status']) => {
      let query = ctx.client
        .from('customer_feedback')
        .select(`
          *,
          table:tables!customer_feedback_table_id_fkey(table_number),
          responded_by_staff:staff!customer_feedback_responded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    acknowledge: async (id: string, staffId: string) => {
      const { data, error } = await ctx.anyClient
        .from('customer_feedback')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    respond: async (
      id: string,
      staffId: string,
      response: string,
      status: CustomerFeedbackRow['status'],
    ) => {
      const { data, error } = await ctx.anyClient
        .from('customer_feedback')
        .update({
          status,
          responded_by: staffId,
          response,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    dismiss: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('customer_feedback')
        .update({ status: 'dismissed' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    getPendingCount: async () => {
      const { count, error } = await ctx.client
        .from('customer_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw handleSupabaseError(error);
      return count || 0;
    },
  };
}

export type FeedbackWrapper = ReturnType<typeof createFeedbackWrapper>;
