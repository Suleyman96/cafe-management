/**
 * Realtime subscriptions wrapper module
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { WrapperContext } from './types';

type PostgresChangeCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) => void;

type SubscribeStatusCallback = (status: string, err?: Error) => void;

function subscribeWithErrorHandler(
  channel: RealtimeChannel,
  onError?: SubscribeStatusCallback,
): RealtimeChannel {
  return channel.subscribe((status, err) => {
    if (onError && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
      onError(status, err instanceof Error ? err : undefined);
    }
  });
}

export function createRealtimeWrapper(ctx: WrapperContext) {
  return {
    subscribeToTables: (
      callback: PostgresChangeCallback,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const channel = ctx.client
        .channel('tables-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, callback);
      return subscribeWithErrorHandler(channel, onError);
    },

    subscribeToOrders: (
      callback: PostgresChangeCallback,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const channel = ctx.client
        .channel('orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback);
      return subscribeWithErrorHandler(channel, onError);
    },

    subscribeToWaiterCalls: (
      callback: PostgresChangeCallback,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const channel = ctx.client
        .channel('waiter-calls-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, callback);
      return subscribeWithErrorHandler(channel, onError);
    },

    unsubscribe: (channel: RealtimeChannel) => {
      return ctx.client.removeChannel(channel);
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
