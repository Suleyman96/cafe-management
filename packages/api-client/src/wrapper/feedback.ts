/**
 * Customer feedback wrapper module
 */

import { handleSupabaseError, isCustomerFeedback } from '@gustri/core';
import type { CustomerFeedbackRow, WrapperContext } from './types';

export function createFeedbackWrapper(ctx: WrapperContext) {
  return {
    create: async (data: {
      table_id: string;
      tenant_id?: string;
      feedback_type: 'complaint' | 'praise';
      message?: string;
      order_id?: string | null;
      status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
    }) => {
      const { data: result, error } = await ctx.anyClient
        .from('customer_feedback')
        .insert({
          ...data,
          status: data.status || 'pending',
        })
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(result)) throw new Error('Invalid feedback data');
      return result as CustomerFeedbackRow;
    },

    findAll: async (options?: {
      status?: CustomerFeedbackRow['status'];
      limit?: number;
      offset?: number;
    }) => {
      let query = ctx.client
        .from('customer_feedback')
        .select(`
          *,
          table:tables!customer_feedback_table_id_fkey(table_number)
        `)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      // Apply pagination with sensible defaults
      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    markRead: async (id: string, staffId: string) => {
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
