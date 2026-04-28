/**
 * Orders wrapper module
 */

import { isOrder } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import type { OrderInsert, OrderRow, PaginatedResult, WrapperContext } from './types';

/**
 * The orders_decrypted view adds decrypted_* columns alongside the raw
 * (encrypted) PII columns. This helper maps them back to the standard names
 * so the rest of the app doesn't need to know about encryption.
 */
function mapDecryptedPii<T extends Record<string, unknown>>(row: T): T {
  if (!row) return row;
  const mapped = { ...row } as Record<string, unknown>;
  if ('decrypted_customer_name' in mapped) {
    mapped.customer_name = mapped.decrypted_customer_name;
    delete mapped.decrypted_customer_name;
  }
  if ('decrypted_customer_phone' in mapped) {
    mapped.customer_phone = mapped.decrypted_customer_phone;
    delete mapped.decrypted_customer_phone;
  }
  if ('decrypted_delivery_address' in mapped) {
    mapped.delivery_address = mapped.decrypted_delivery_address;
    delete mapped.decrypted_delivery_address;
  }
  return mapped as T;
}

function mapDecryptedPiiArray<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(mapDecryptedPii);
}

export function createOrdersWrapper(ctx: WrapperContext) {
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

      let query = ctx.anyClient
        .from('orders_decrypted')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          delivery_person:staff!orders_delivery_person_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

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
      let query = ctx.anyClient
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
        .order('created_at', { ascending: false });

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
      const { data, error } = await ctx.anyClient
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
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return mapDecryptedPii(data);
    },

    create: async (orderData: OrderInsert) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    updateStatus: async (id: string, status: OrderRow['status']) => {
      // Prevent "served" status on delivery and takeout orders
      if (status === 'served') {
        const { data: order, error: fetchError } = await ctx.anyClient
          .from('orders')
          .select('order_type')
          .eq('id', id)
          .single();
        if (fetchError) throw handleSupabaseError(fetchError);
        const orderType = (order as { order_type: string } | null)?.order_type;
        if (orderType === 'delivery') {
          throw new Error(
            'Delivery orders cannot be set to "served". Use "out_for_delivery" instead.',
          );
        }
        if (orderType === 'takeout') {
          throw new Error(
            'Takeout orders cannot be set to "served". Use "ready" and then close after payment.',
          );
        }
      }

      // Prevent advancing empty orders (no non-cancelled items)
      const advanceStatuses: string[] = [
        'preparing',
        'ready',
        'served',
        'out_for_delivery',
        'delivered',
      ];
      if (advanceStatuses.includes(status)) {
        const { data: items } = await ctx.client
          .from('order_items')
          .select('id')
          .eq('order_id', id)
          .neq('status', 'cancelled')
          .limit(1);

        if (!items || items.length === 0) {
          throw new Error(
            'Cannot advance order with no items. Add items first or cancel the order.',
          );
        }
      }

      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    findActiveByTable: async (tableId: string) => {
      const { data, error } = await ctx.anyClient
        .from('orders_decrypted')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(*)
        `)
        .eq('table_id', tableId)
        .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw handleSupabaseError(error);
      return data ? mapDecryptedPii(data) : null;
    },

    getActiveOrders: async () => {
      const { data, error } = await ctx.anyClient
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
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray(data || []);
    },

    assignWaiter: async (orderId: string, waiterId: string | null) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({ assigned_waiter_id: waiterId })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    cancelOrder: async (orderId: string, reason: string, tableId?: string | null) => {
      // Update order status to cancelled and store reason in internal_notes
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({
          status: 'cancelled',
          internal_notes: `Cancelled: ${reason}`,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');

      // If the order has a table, check if there are other active orders before setting it to free
      if (tableId) {
        // Check for other active orders on this table
        const { data: otherOrders } = await ctx.client
          .from('orders')
          .select('id')
          .eq('table_id', tableId)
          .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
          .neq('id', orderId)
          .limit(1);

        // Only set table to free if no other active orders exist
        if (!otherOrders || otherOrders.length === 0) {
          await ctx.anyClient
            .from('tables')
            .update({ status: 'free', occupied_at: null })
            .eq('id', tableId);
        }
      }

      return data as OrderRow;
    },

    updateNotes: async (
      orderId: string,
      notes: { customer_notes?: string | null; internal_notes?: string | null },
    ) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update(notes)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    applyDiscount: async (
      orderId: string,
      discount: {
        discount_type: 'none' | 'percentage' | 'fixed';
        discount_value: number;
        discount_reason?: string | null;
        discount_applied_by: string;
      },
    ) => {
      // Don't chain .select() — the recalculate_on_discount_change trigger
      // modifies the same row, causing PostgREST "Cannot coerce" errors.
      const { error } = await ctx.anyClient
        .from('orders')
        .update({
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          discount_reason: discount.discount_reason || null,
          discount_applied_by: discount.discount_applied_by,
        })
        .eq('id', orderId);

      if (error) throw handleSupabaseError(error);

      // Fetch the updated order after the trigger has recalculated totals
      const { data, error: fetchError } = await ctx.anyClient
        .from('orders_decrypted')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);
      return mapDecryptedPii(data) as OrderRow;
    },

    // Takeout-specific methods
    findTakeoutOrders: async (options?: { limit?: number; offset?: number }) => {
      let query = ctx.anyClient
        .from('orders_decrypted')
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          order_payments(
            *,
            received_by_staff:staff!order_payments_received_by_fkey(full_name)
          )
        `)
        .eq('order_type', 'takeout')
        .order('created_at', { ascending: false });

      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;
      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray(data || []);
    },

    // Delivery-specific methods
    findDeliveryOrders: async (options?: { limit?: number; offset?: number }) => {
      let query = ctx.anyClient
        .from('orders_decrypted')
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          delivery_person:staff!orders_delivery_person_id_fkey(full_name)
        `)
        .eq('order_type', 'delivery')
        .order('created_at', { ascending: false });

      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;
      if (error) throw handleSupabaseError(error);
      return mapDecryptedPiiArray(data || []);
    },

    findDeliveryById: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('orders_decrypted')
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          delivery_person:staff!orders_delivery_person_id_fkey(full_name),
          order_payments(
            *,
            received_by_staff:staff!order_payments_received_by_fkey(full_name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return mapDecryptedPii(data);
    },

    assignDeliveryPerson: async (orderId: string, staffId: string) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({ delivery_person_id: staffId })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    updateDeliveryFee: async (orderId: string, fee: number) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({ delivery_fee: fee })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    markOutForDelivery: async (orderId: string, deliveryPersonId: string) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({
          status: 'out_for_delivery',
          delivery_person_id: deliveryPersonId,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    markDelivered: async (orderId: string) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    cleanupEmptyOrders: async (olderThanMinutes = 2) => {
      const { data, error } = await ctx.anyClient.rpc('cleanup_empty_orders', {
        p_older_than_minutes: olderThanMinutes,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []).map((row: { cancelled_order_id: string }) => row.cancelled_order_id);
    },
  };
}

export type OrdersWrapper = ReturnType<typeof createOrdersWrapper>;
