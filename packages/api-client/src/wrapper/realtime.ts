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

export interface RealtimeSubscribeOptions {
  callback: PostgresChangeCallback;
  tenantId?: string;
  onError?: SubscribeStatusCallback;
}

export function createRealtimeWrapper(ctx: WrapperContext) {
  function buildFilter(tenantId?: string) {
    return tenantId ? `tenant_id=eq.${tenantId}` : undefined;
  }

  return {
    subscribeToTables: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const opts =
        typeof callbackOrOptions === 'function'
          ? { callback: callbackOrOptions, onError }
          : callbackOrOptions;
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('tables-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables', filter },
          opts.callback,
        );
      return subscribeWithErrorHandler(channel, opts.onError);
    },

    subscribeToOrders: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const opts =
        typeof callbackOrOptions === 'function'
          ? { callback: callbackOrOptions, onError }
          : callbackOrOptions;
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter },
          opts.callback,
        );
      return subscribeWithErrorHandler(channel, opts.onError);
    },

    subscribeToWaiterCalls: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): RealtimeChannel => {
      const opts =
        typeof callbackOrOptions === 'function'
          ? { callback: callbackOrOptions, onError }
          : callbackOrOptions;
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('waiter-calls-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls', filter },
          opts.callback,
        );
      return subscribeWithErrorHandler(channel, opts.onError);
    },

    unsubscribe: (channel: RealtimeChannel) => {
      return ctx.client.removeChannel(channel);
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
