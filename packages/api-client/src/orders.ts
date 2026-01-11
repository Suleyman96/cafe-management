import { TypedSupabaseClient, QueryOptions } from './types';
import { handleSupabaseError, ORDER_STATUS } from '@cafe-idare/core';
import type { OrdersInsert, OrdersUpdate, Orders, OrderItems } from '@cafe-idare/database';

export interface OrderFilters extends QueryOptions {
  status?: string;
  tableId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getOrders(
  client: TypedSupabaseClient,
  filters?: OrderFilters
) {
  let query = client
    .from('orders')
    .select(`
      *,
      table:tables(*),
      staff:staff(*),
      order_items(
        *,
        menu_item:menu_items(*)
      )
    `);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.tableId) {
    query = query.eq('table_id', filters.tableId);
  }
  
  if (filters?.staffId) {
    query = query.eq('staff_id', filters.staffId);
  }
  
  if (filters?.fromDate) {
    query = query.gte('created_at', filters.fromDate);
  }
  
  if (filters?.toDate) {
    query = query.lte('created_at', filters.toDate);
  }

  query = query.order(filters?.orderBy || 'created_at', { 
    ascending: filters?.ascending ?? false 
  });
  
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getOrder(
  client: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('orders')
    .select(`
      *,
      table:tables(*),
      staff:staff(*),
      order_items(
        *,
        menu_item:menu_items(*)
      )
    `)
    .eq('id', id)
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createOrder(
  client: TypedSupabaseClient,
  order: OrdersInsert
) {
  const { data, error } = await (client as any)
    .from('orders')
    .insert(order)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateOrder(
  client: TypedSupabaseClient,
  id: string,
  updates: OrdersUpdate
) {
  const { data, error } = await (client as any)
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateOrderStatus(
  client: TypedSupabaseClient,
  id: string,
  status: keyof typeof ORDER_STATUS
) {
  return updateOrder(client, id, { status: ORDER_STATUS[status] });
}

export async function getActiveOrders(
  client: TypedSupabaseClient
) {
  return getOrders(client, {
    status: 'new,preparing,ready,served',
    orderBy: 'created_at',
    ascending: true
  });
}

export async function getTableActiveOrder(
  client: TypedSupabaseClient,
  tableId: string
) {
  const { data, error } = await client
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        menu_item:menu_items(*)
      )
    `)
    .eq('table_id', tableId)
    .in('status', ['new', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error && error.code !== 'PGRST116') { // Not found is ok
    throw handleSupabaseError(error);
  }
  
  return data;
}