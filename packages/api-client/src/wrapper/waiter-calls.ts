/**
 * Waiter calls wrapper module
 */

import { isWaiterCall } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { dedupeInsert } from './_dedupe';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { WaiterCallRow, WrapperContext } from './types';

export function createWaiterCallsWrapper(ctx: WrapperContext) {
  return {
    create: async (data: {
      table_id: string;
      tenant_id?: string;
      call_type?: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
      reason?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      status?: 'pending' | 'acknowledged' | 'resolved';
      client_request_id?: string | null;
    }) => {
      const insertRow = { ...data, status: data.status || 'pending' };
      assertInsertTenantMatches(insertRow, ctx);

      const result = await dedupeInsert<unknown>(data.client_request_id, {
        insert: () => ctx.anyClient.from('waiter_calls').insert(insertRow).select().single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('waiter_calls')
              .select()
              .eq('client_request_id', data.client_request_id ?? ''),
            ctx,
            // Anon QR call may run before tenant context binds.
            { allowNull: true },
          ).single(),
      });

      if (!isWaiterCall(result)) throw new Error('Invalid waiter call data');
      return result as WaiterCallRow;
    },

    findByTable: async (tableId: string, status?: WaiterCallRow['status']) => {
      // Anon QR session reads its own table's calls before tenant binding.
      let query = applyTenantScope(
        ctx.client
          .from('waiter_calls')
          .select('*')
          .eq('table_id', tableId)
          .order('created_at', { ascending: false }),
        ctx,
        { allowNull: true },
      );

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findAll: async (options?: {
      status?: WaiterCallRow['status'];
      limit?: number;
      offset?: number;
    }) => {
      let query = applyTenantScope(
        ctx.client
          .from('waiter_calls')
          .select(`
            *,
            table:tables!waiter_calls_table_id_fkey(table_number, location)
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
      const { count, error } = await applyTenantScope(
        ctx.client
          .from('waiter_calls')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return count ?? 0;
    },
  };
}

export type WaiterCallsWrapper = ReturnType<typeof createWaiterCallsWrapper>;
