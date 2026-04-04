/**
 * Waiter calls wrapper module
 */

import { handleSupabaseError, isWaiterCall } from '@gustri/core';
import type { WaiterCallRow, WrapperContext } from './types';

export function createWaiterCallsWrapper(ctx: WrapperContext) {
  return {
    create: async (data: {
      table_id: string;
      call_type?: string;
      reason?: string;
      priority?: string;
      status?: string;
    }) => {
      const { data: result, error } = await ctx.anyClient
        .from('waiter_calls')
        .insert({
          ...data,
          status: data.status || 'pending',
        })
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(result)) throw new Error('Invalid waiter call data');
      return result as WaiterCallRow;
    },

    findByTable: async (tableId: string, status?: WaiterCallRow['status']) => {
      let query = ctx.client
        .from('waiter_calls')
        .select('*')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findAll: async (status?: WaiterCallRow['status']) => {
      let query = ctx.client
        .from('waiter_calls')
        .select(`
          *,
          table:tables!waiter_calls_table_id_fkey(table_number, location)
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
        .from('waiter_calls')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    resolve: async (id: string, notes?: string) => {
      const { data, error } = await ctx.anyClient
        .from('waiter_calls')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    getPendingCount: async () => {
      const { count, error } = await ctx.client
        .from('waiter_calls')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw handleSupabaseError(error);
      return count ?? 0;
    },
  };
}

export type WaiterCallsWrapper = ReturnType<typeof createWaiterCallsWrapper>;
