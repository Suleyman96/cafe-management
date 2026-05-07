/**
 * Customer feedback wrapper module
 *
 * Insert path (`create`) was deleted in audit 18 once customer-web migrated to
 * the rate-limited `/api/v1/customer/feedback` route (PR #97) and mobile was
 * verified not to call it. Server-side inserts go through
 * `customer-engagement-service.ts` directly.
 */

import { isCustomerFeedback } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope } from './_tenant-scope';
import type { CustomerFeedbackRow, WrapperContext } from './types';

export function createFeedbackWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: {
      status?: CustomerFeedbackRow['status'];
      limit?: number;
      offset?: number;
    }) => {
      let query = applyTenantScope(
        ctx.client
          .from('customer_feedback')
          .select(`
            *,
            table:tables!customer_feedback_table_id_fkey(table_number)
          `)
          .order('created_at', { ascending: false }),
        ctx,
      );

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
      const { count, error } = await applyTenantScope(
        ctx.client
          .from('customer_feedback')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return count || 0;
    },
  };
}

export type FeedbackWrapper = ReturnType<typeof createFeedbackWrapper>;
