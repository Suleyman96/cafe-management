import { TypedSupabaseClient, QueryOptions } from './types';
import { handleSupabaseError, WAITER_CALL_STATUS } from '@cafe-idare/core';
import type { WaiterCallsInsert, WaiterCallsUpdate } from '@cafe-idare/database';

export interface WaiterCallFilters extends QueryOptions {
  status?: string;
  tableId?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getWaiterCalls(
  client: TypedSupabaseClient,
  filters?: WaiterCallFilters
) {
  let query = client
    .from('waiter_calls')
    .select(`
      *,
      table:tables(*)
    `);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.tableId) {
    query = query.eq('table_id', filters.tableId);
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

export async function getPendingWaiterCalls(
  client: TypedSupabaseClient
) {
  return getWaiterCalls(client, {
    status: WAITER_CALL_STATUS.PENDING,
    orderBy: 'created_at',
    ascending: true
  });
}

export async function createWaiterCall(
  client: TypedSupabaseClient,
  call: WaiterCallsInsert
) {
  const { data, error } = await (client as any)
    .from('waiter_calls')
    .insert(call)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateWaiterCall(
  client: TypedSupabaseClient,
  id: string,
  updates: WaiterCallsUpdate
) {
  const { data, error } = await (client as any)
    .from('waiter_calls')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function acknowledgeWaiterCall(
  client: TypedSupabaseClient,
  id: string,
  staffId: string
) {
  return updateWaiterCall(client, id, {
    status: WAITER_CALL_STATUS.ACKNOWLEDGED,
    acknowledged_at: new Date().toISOString()
  });
}

export async function resolveWaiterCall(
  client: TypedSupabaseClient,
  id: string
) {
  return updateWaiterCall(client, id, {
    status: WAITER_CALL_STATUS.RESOLVED,
    resolved_at: new Date().toISOString()
  });
}