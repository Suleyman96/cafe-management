/**
 * Orders wrapper — takeout and delivery channel methods (channel-scoped
 * lists/lookups plus delivery dispatch transitions).
 */

import { isOrder } from '@gustri/core';
import { handleSupabaseError } from '../../errors';
import type { OrderRow, WrapperContext } from '../types';
import { mapDecryptedPii, mapDecryptedPiiArray } from './_shared';

export function createOrderChannelMethods(ctx: WrapperContext) {
  return {
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
  };
}
