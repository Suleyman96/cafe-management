/**
 * Realtime subscriptions wrapper module
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { WrapperContext } from './types';

type PostgresChangeCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) => void;

export function createRealtimeWrapper(ctx: WrapperContext) {
  return {
    subscribeToTables: (callback: PostgresChangeCallback): RealtimeChannel => {
      return ctx.client
        .channel('tables-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, callback)
        .subscribe();
    },

    subscribeToOrders: (callback: PostgresChangeCallback): RealtimeChannel => {
      return ctx.client
        .channel('orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
        .subscribe();
    },

    subscribeToWaiterCalls: (callback: PostgresChangeCallback): RealtimeChannel => {
      return ctx.client
        .channel('waiter-calls-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, callback)
        .subscribe();
    },

    unsubscribe: (channel: RealtimeChannel) => {
      return ctx.client.removeChannel(channel);
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
