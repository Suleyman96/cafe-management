import { TypedSupabaseClient, QueryOptions } from './types';
import { handleSupabaseError } from '@cafe-idare/core';
import type { TablesInsert, TablesUpdate, Tables } from '@cafe-idare/database';

export async function getTables(
  client: TypedSupabaseClient,
  options?: QueryOptions
) {
  const query = client
    .from('tables')
    .select('*');

  if (options?.orderBy) {
    query.order(options.orderBy, { ascending: options.ascending ?? true });
  }
  
  if (options?.limit) {
    query.limit(options.limit);
  }
  
  if (options?.offset) {
    query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;
  
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getTable(
  client: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('tables')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createTable(
  client: TypedSupabaseClient,
  table: TablesInsert
) {
  const { data, error } = await (client as any)
    .from('tables')
    .insert(table)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateTable(
  client: TypedSupabaseClient,
  id: string,
  updates: TablesUpdate
) {
  const { data, error } = await (client as any)
    .from('tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function deleteTable(
  client: TypedSupabaseClient,
  id: string
) {
  const { error } = await (client as any)
    .from('tables')
    .delete()
    .eq('id', id);
    
  if (error) throw handleSupabaseError(error);
}

export async function getTableWithActiveOrder(
  client: TypedSupabaseClient,
  tableId: string
) {
  const { data: table, error: tableError } = await (client as any)
    .from('tables')
    .select('*')
    .eq('id', tableId)
    .single();
    
  if (tableError) throw handleSupabaseError(tableError);

  const { data: orders, error: ordersError } = await (client as any)
    .from('orders')
    .select('*')
    .eq('table_id', tableId)
    .in('status', ['new', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (ordersError) throw handleSupabaseError(ordersError);
  
  return {
    ...table,
    activeOrder: orders?.[0] || null
  };
}