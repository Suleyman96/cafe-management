/**
 * Waiter calls wrapper module
 *
 * Insert path (`create`) was deleted in audit 18 once customer-web migrated to
 * the rate-limited `/api/v1/customer/waiter-calls` route (PR #97) and mobile
 * was verified not to call it. Server-side inserts go through
 * `customer-engagement-service.ts` directly. Read/acknowledge/resolve paths
 * stay here because staff-web still uses them via TanStack Query hooks.
 */

import { isWaiterCall } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope } from './_tenant-scope';
import type { WaiterCallRow, WrapperContext } from './types';

export function createWaiterCallsWrapper(ctx: WrapperContext) {
  return {
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

    /**
     * Mark a call as acknowledged by `staffId`.
     *
     * `clientRequestId` is required for idempotent retries: a second call
     * with the same id refetches the original row instead of clobbering
     * it. The migration 20260506000001 partial unique index on
     * (tenant_id, acknowledged_client_request_id) enforces dedupe; the
     * sibling BEFORE UPDATE trigger rejects cross-staff overwrites with
     * sentinel `waiter_call_already_acknowledged`, which
     * handleSupabaseError maps to ConflictError.
     */
    acknowledge: async (
      id: string,
      staffId: string,
      opts?: { clientRequestId?: string | null },
    ) => {
      const updatePayload: Record<string, unknown> = {
        status: 'acknowledged',
        responded_by: staffId,
        acknowledged_at: new Date().toISOString(),
      };
      if (opts?.clientRequestId) {
        updatePayload.acknowledged_client_request_id = opts.clientRequestId;
      }

      const { data, error } = await ctx.anyClient
        .from('waiter_calls')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Idempotent replay: the (tenant_id, acknowledged_client_request_id)
        // partial unique index trips 23505 when the same key is reused.
        // Refetch the original row so the caller sees a successful response
        // shape rather than a phantom conflict.
        if (opts?.clientRequestId && (error as { code?: string }).code === '23505') {
          const refetched = await ctx.anyClient
            .from('waiter_calls')
            .select()
            .eq('acknowledged_client_request_id', opts.clientRequestId)
            .single();
          if (refetched.error) throw handleSupabaseError(refetched.error);
          if (!isWaiterCall(refetched.data)) throw new Error('Invalid waiter call data');
          return refetched.data as WaiterCallRow;
        }
        throw handleSupabaseError(error);
      }
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    /**
     * Mark a call as resolved. Same idempotency contract as acknowledge.
     * Cross-staff resolve overwrite trips
     * sentinel `waiter_call_already_resolved` → ConflictError.
     */
    resolve: async (id: string, opts?: { notes?: string; clientRequestId?: string | null }) => {
      const updatePayload: Record<string, unknown> = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        notes: opts?.notes,
      };
      if (opts?.clientRequestId) {
        updatePayload.resolved_client_request_id = opts.clientRequestId;
      }

      const { data, error } = await ctx.anyClient
        .from('waiter_calls')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (opts?.clientRequestId && (error as { code?: string }).code === '23505') {
          const refetched = await ctx.anyClient
            .from('waiter_calls')
            .select()
            .eq('resolved_client_request_id', opts.clientRequestId)
            .single();
          if (refetched.error) throw handleSupabaseError(refetched.error);
          if (!isWaiterCall(refetched.data)) throw new Error('Invalid waiter call data');
          return refetched.data as WaiterCallRow;
        }
        throw handleSupabaseError(error);
      }
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    /**
     * Catchup query for realtime resubscribe — symmetric with
     * `orders.findChangedSince`. After the WS reconnects, the caller fetches
     * waiter calls created since the checkpoint and re-fires deduplicated
     * audio for genuinely-new pending calls. Without this, buzzes that fired
     * during the gap are silently lost and a table can sit waiting unnoticed.
     *
     * `waiter_calls` has no `updated_at` column; filtering on `created_at` is
     * the right semantic anyway because the audio surface only fires on
     * INSERT (a fresh call asking for assistance) — acknowledge/resolve
     * UPDATEs don't trigger sound.
     */
    findCreatedSince: async (
      since: Date | string,
      options?: { limit?: number },
    ): Promise<WaiterCallRow[]> => {
      const sinceIso = typeof since === 'string' ? since : since.toISOString();
      const limit = options?.limit ?? 200;
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('waiter_calls')
          .select('*')
          .gt('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return (data || []) as WaiterCallRow[];
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
