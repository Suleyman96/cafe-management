/**
 * Orders wrapper — read queries (lists, lookups, realtime catch-up).
 */

import { isOrder } from '@gustri/core';
import { handleSupabaseError } from '../../errors';
import { applyTenantScope } from '../_tenant-scope';
import type { OrderRow, PaginatedResult, WrapperContext } from '../types';
import { mapDecryptedPii, mapDecryptedPiiArray } from './_shared';

export function createOrderQueries(ctx: WrapperContext) {
  return {
    findAll: async (filters?: {
      status?: OrderRow['status'];
      statuses?: OrderRow['status'][];
      table_id?: string;
      order_type?: OrderRow['order_type'];
      assigned_waiter_id?: string;
      created_after?: string;
      created_before?: string;
      limit?: number;
      offset?: number;
    }) => {
      // Require an explicit scope. Without one, this query silently capped at
      // 200 rows and older orders disappeared as a tenant grew. Callers must
      // pass either a `limit` (active/kitchen views) or `created_after` (date
      // window). Use `findAllPaginated` for unbounded history scrolling.
      if (!filters?.limit && !filters?.created_after) {
        throw new Error(
          'orders.findAll requires either an explicit `limit` or `created_after` filter. ' +
            'Unbounded queries are not allowed — use findAllPaginated for history views.',
        );
      }

      let query = applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select(`
            *,
            table:tables!orders_table_id_fkey(table_number, location),
            order_items(
              *,
              menu_item:menu_items(*)
            ),
            assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
            delivery_person:staff!orders_delivery_person_id_fkey(full_name),
            order_payments(
              *,
              received_by_staff:staff!order_payments_received_by_fkey(full_name)
            ),
            refunds(amount)
          `)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      } else if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.table_id) {
        query = query.eq('table_id', filters.table_id);
      }
      if (filters.order_type) {
        query = query.eq('order_type', filters.order_type);
      }
      if (filters.assigned_waiter_id) {
        query = query.eq('assigned_waiter_id', filters.assigned_waiter_id);
      }
      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }
      if (filters.created_before) {
        query = query.lt('created_at', filters.created_before);
      }

      if (filters.limit && filters.limit > 0) {
        const offset = filters.offset ?? 0;
        query = query.range(offset, offset + filters.limit - 1);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray(data || []);
    },

    findAllPaginated: async (filters?: {
      status?: OrderRow['status'];
      statuses?: OrderRow['status'][];
      table_id?: string;
      order_type?: OrderRow['order_type'];
      assigned_waiter_id?: string;
      created_after?: string;
      created_before?: string;
      limit?: number;
      offset?: number;
    }): Promise<PaginatedResult<OrderRow>> => {
      let query = applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select(
            `
            *,
            table:tables!orders_table_id_fkey(table_number, location),
            order_items(
              *,
              menu_item:menu_items(*)
            ),
            assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
            delivery_person:staff!orders_delivery_person_id_fkey(full_name)
          `,
            { count: 'exact' },
          )
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      } else if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.table_id) {
        query = query.eq('table_id', filters.table_id);
      }
      if (filters?.order_type) {
        query = query.eq('order_type', filters.order_type);
      }
      if (filters?.assigned_waiter_id) {
        query = query.eq('assigned_waiter_id', filters.assigned_waiter_id);
      }
      if (filters?.created_after) {
        query = query.gte('created_at', filters.created_after);
      }
      if (filters?.created_before) {
        query = query.lt('created_at', filters.created_before);
      }

      const limit = filters?.limit ?? 50;
      const offset = filters?.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw handleSupabaseError(error);
      return {
        data: mapDecryptedPiiArray((data || []) as OrderRow[]),
        count: count ?? 0,
        hasMore: (count ?? 0) > offset + limit,
      };
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select(`
            *,
            table:tables!orders_table_id_fkey(table_number, location),
            order_items(
              *,
              menu_item:menu_items(*)
            ),
            assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
            delivery_person:staff!orders_delivery_person_id_fkey(full_name),
            order_payments(
              *,
              received_by_staff:staff!order_payments_received_by_fkey(full_name)
            ),
            table_transfers(
              *,
              from_table:tables!table_transfers_from_table_id_fkey(table_number),
              to_table:tables!table_transfers_to_table_id_fkey(table_number),
              transferred_by_staff:staff!table_transfers_transferred_by_fkey(full_name)
            )
          `)
          .eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return mapDecryptedPii(data);
    },

    /**
     * Catchup query for realtime resubscribe.
     *
     * Supabase Realtime has no replay buffer: any postgres_changes events
     * emitted while a client's WebSocket was down are gone. After a
     * successful resubscribe, callers fetch every row that moved since the
     * checkpoint and re-fire downstream behavior (cache invalidation +
     * deduplicated audio for genuinely-new orders).
     *
     * Cap: `limit` defaults to 200. A long disconnect that produced more
     * than 200 changed rows returns the most-recent 200; the caller should
     * surface a "missed updates — refresh" hint when the cap is hit (the
     * cache will catch up naturally on the next manual refresh / next
     * fallback poll).
     *
     * The query orders by `updated_at DESC` so callers see newest changes
     * first, which matters when the cap is exceeded — a stale 250-row
     * window prefers fresh data over old data.
     */
    findChangedSince: async (
      since: Date | string,
      options?: { limit?: number },
    ): Promise<OrderRow[]> => {
      const sinceIso = typeof since === 'string' ? since : since.toISOString();
      const limit = options?.limit ?? 200;
      const { data, error } = await applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select('*')
          .gt('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray((data || []) as OrderRow[]);
    },

    findActiveByTable: async (tableId: string) => {
      const { data, error } = await applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select(`
            *,
            table:tables!orders_table_id_fkey(table_number, location),
            order_items(*)
          `)
          .eq('table_id', tableId)
          .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
          .order('created_at', { ascending: false })
          .limit(1),
        ctx,
        // Anon QR sessions read this before the tenant context is bound.
        { allowNull: true },
      ).maybeSingle();

      if (error) throw handleSupabaseError(error);
      return data ? mapDecryptedPii(data) : null;
    },

    getActiveOrders: async () => {
      const { data, error } = await applyTenantScope(
        ctx.anyClient
          .from('orders_decrypted')
          .select(`
            *,
            table:tables!orders_table_id_fkey(table_number),
            order_items(count)
          `)
          .in('status', [
            'pending_approval',
            'new',
            'preparing',
            'ready',
            'served',
            'out_for_delivery',
          ])
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray(data || []);
    },
  };
}
