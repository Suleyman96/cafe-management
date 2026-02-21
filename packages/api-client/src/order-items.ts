import { handleSupabaseError, ORDER_ITEM_STATUS } from '@cafe-idare/core';
import type { OrderItemsInsert, OrderItemsUpdate } from '@cafe-idare/database';
import type { TypedSupabaseClient } from './types';

export async function getOrderItems(client: TypedSupabaseClient, orderId: string) {
  const { data, error } = await client
    .from('order_items')
    .select(`
      *,
      menu_item:menu_items(*)
    `)
    .eq('order_id', orderId)
    .order('created_at');

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createOrderItem(client: TypedSupabaseClient, item: OrderItemsInsert) {
  const { data, error } = await (client as any).from('order_items').insert(item).select().single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createOrderItems(client: TypedSupabaseClient, items: OrderItemsInsert[]) {
  const { data, error } = await (client as any).from('order_items').insert(items).select();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateOrderItem(
  client: TypedSupabaseClient,
  id: string,
  updates: OrderItemsUpdate,
) {
  const { data, error } = await (client as any)
    .from('order_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateOrderItemStatus(
  client: TypedSupabaseClient,
  id: string,
  status: keyof typeof ORDER_ITEM_STATUS,
) {
  return updateOrderItem(client, id, { status: ORDER_ITEM_STATUS[status] });
}

export async function deleteOrderItem(client: TypedSupabaseClient, id: string) {
  const { error } = await (client as any).from('order_items').delete().eq('id', id);

  if (error) throw handleSupabaseError(error);
}

export async function getKitchenOrders(client: TypedSupabaseClient) {
  const { data, error } = await client
    .from('order_items')
    .select(`
      *,
      menu_item:menu_items(*),
      order:orders(
        *,
        table:tables(*)
      )
    `)
    .in('status', ['pending', 'preparing'])
    .order('created_at');

  if (error) throw handleSupabaseError(error);
  return data;
}
