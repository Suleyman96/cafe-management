import type { Database } from '@cafe-idare/database';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from './types';

type TableName = keyof Database['public']['Tables'];
type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];

export interface RealtimeOptions {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export function subscribeToTable<T extends TableName>(
  client: TypedSupabaseClient,
  table: T,
  options: RealtimeOptions,
): RealtimeChannel {
  const channel = client
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: RealtimePostgresChangesPayload<TableRow<T>>) => {
        switch (payload.eventType) {
          case 'INSERT':
            options.onInsert?.(payload.new);
            break;
          case 'UPDATE':
            options.onUpdate?.(payload.new);
            break;
          case 'DELETE':
            options.onDelete?.(payload.old);
            break;
        }
      },
    )
    .subscribe();

  return channel;
}

export function subscribeToOrders(client: TypedSupabaseClient, options: RealtimeOptions) {
  return subscribeToTable(client, 'orders', options);
}

export function subscribeToOrderItems(client: TypedSupabaseClient, options: RealtimeOptions) {
  return subscribeToTable(client, 'order_items', options);
}

export function subscribeToTables(client: TypedSupabaseClient, options: RealtimeOptions) {
  return subscribeToTable(client, 'tables', options);
}

export function subscribeToWaiterCalls(client: TypedSupabaseClient, options: RealtimeOptions) {
  return subscribeToTable(client, 'waiter_calls', options);
}

export function unsubscribe(channel: RealtimeChannel) {
  return channel.unsubscribe();
}

// Kitchen-specific subscription
export function subscribeToKitchenUpdates(
  client: TypedSupabaseClient,
  handlers: {
    onNewItem: (item: any) => void;
    onItemStatusChange: (item: any) => void;
  },
) {
  const channel = client
    .channel('kitchen_updates')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_items',
        filter: 'status=eq.pending',
      },
      (payload) => handlers.onNewItem(payload.new),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_items',
        filter: 'status=in.(preparing,ready)',
      },
      (payload) => handlers.onItemStatusChange(payload.new),
    )
    .subscribe();

  return channel;
}

// Waiter-specific subscription
export function subscribeToWaiterUpdates(
  client: TypedSupabaseClient,
  handlers: {
    onNewCall: (call: any) => void;
    onOrderReady: (order: any) => void;
  },
) {
  const channel = client
    .channel('waiter_updates')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'waiter_calls',
        filter: 'status=eq.pending',
      },
      (payload) => handlers.onNewCall(payload.new),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.ready',
      },
      (payload) => handlers.onOrderReady(payload.new),
    )
    .subscribe();

  return channel;
}
