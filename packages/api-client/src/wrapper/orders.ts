/**
 * Orders wrapper module
 */

import { handleSupabaseError, isOrder, isOrderItem, isOrderItemArray } from '@cafe-idare/core';
import type { OrderInsert, OrderItemInsert, OrderItemRow, OrderRow, WrapperContext } from './types';

export function createOrdersWrapper(ctx: WrapperContext) {
  return {
    findAll: async (filters?: {
      status?: OrderRow['status'];
      table_id?: string;
      order_type?: OrderRow['order_type'];
    }) => {
      let query = ctx.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.table_id) {
        query = query.eq('table_id', filters.table_id);
      }
      if (filters?.order_type) {
        query = query.eq('order_type', filters.order_type);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
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
      return data;
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
      const { data, error } = await ctx.client
        .from('orders')
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
      return data;
    },

    getActiveOrders: async () => {
      const { data, error } = await ctx.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number),
          order_items(count)
        `)
        .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
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
  };
}

export function createOrderItemsWrapper(ctx: WrapperContext) {
  return {
    create: async (items: OrderItemInsert[]) => {
      const { data, error } = await ctx.anyClient.from('order_items').insert(items).select();

      if (error) throw handleSupabaseError(error);
      const orderItems = data || [];
      if (!isOrderItemArray(orderItems)) throw new Error('Invalid order items data');
      return orderItems as OrderItemRow[];
    },

    updateStatus: async (id: string, status: OrderItemRow['status']) => {
      const { data, error } = await ctx.anyClient
        .from('order_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data as OrderItemRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('order_items').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type OrdersWrapper = ReturnType<typeof createOrdersWrapper>;
export type OrderItemsWrapper = ReturnType<typeof createOrderItemsWrapper>;
