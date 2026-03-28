/**
 * Orders wrapper module
 */

import { handleSupabaseError, isOrder, isOrderItem, isOrderItemArray } from '@gustri/core';
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
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          delivery_person:staff!orders_delivery_person_id_fkey(full_name)
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

    // Delivery-specific methods
    findDeliveryOrders: async () => {
      const { data, error } = await ctx.client
        .from('orders')
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

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findDeliveryById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('orders')
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
      return data;
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
      const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

      // Find active orders with 0 items that are older than the cutoff
      const { data: emptyOrders, error: findError } = await ctx.client
        .from('orders')
        .select('id, table_id, order_items(id)')
        .in('status', ['new', 'pending_approval'])
        .lt('created_at', cutoff);

      if (findError) throw handleSupabaseError(findError);

      const ordersToCancel: { id: string; table_id: string | null }[] = (emptyOrders || []).filter(
        (o: any) => !o.order_items || o.order_items.length === 0,
      );

      if (ordersToCancel.length === 0) return [];

      // Cancel each empty order and free the table if needed
      const cancelledIds: string[] = [];
      for (const order of ordersToCancel) {
        const { error: cancelError } = await ctx.anyClient
          .from('orders')
          .update({ status: 'cancelled', internal_notes: 'Auto-cancelled: empty order' })
          .eq('id', order.id);

        if (!cancelError) {
          cancelledIds.push(order.id);

          // Free the table if no other active orders
          if (order.table_id) {
            const { data: otherOrders } = await ctx.client
              .from('orders')
              .select('id')
              .eq('table_id', order.table_id)
              .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
              .neq('id', order.id)
              .limit(1);

            if (!otherOrders || otherOrders.length === 0) {
              await ctx.anyClient
                .from('tables')
                .update({ status: 'free', occupied_at: null })
                .eq('id', order.table_id);
            }
          }
        }
      }

      return cancelledIds;
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

    cancel: async (id: string, cancelQty?: number) => {
      if (cancelQty !== undefined && cancelQty > 0) {
        // Partial cancel: fetch current item, reduce quantity, or cancel if all
        const { data: current, error: fetchError } = await ctx.anyClient
          .from('order_items')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw handleSupabaseError(fetchError);
        if (!current) throw new Error('Order item not found');
        const currentItem = current as OrderItemRow;

        if (cancelQty >= currentItem.quantity) {
          // Cancel entire item
          const { data, error } = await ctx.anyClient
            .from('order_items')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();
          if (error) throw handleSupabaseError(error);
          if (!isOrderItem(data)) throw new Error('Invalid order item data');
          return data as OrderItemRow;
        }

        // Reduce quantity
        const { data, error } = await ctx.anyClient
          .from('order_items')
          .update({ quantity: currentItem.quantity - cancelQty })
          .eq('id', id)
          .select()
          .single();
        if (error) throw handleSupabaseError(error);
        if (!isOrderItem(data)) throw new Error('Invalid order item data');
        return data as OrderItemRow;
      }

      // Cancel entire item (no quantity specified)
      const { data, error } = await ctx.anyClient
        .from('order_items')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data as OrderItemRow;
    },
  };
}

export type OrdersWrapper = ReturnType<typeof createOrdersWrapper>;
export type OrderItemsWrapper = ReturnType<typeof createOrderItemsWrapper>;
