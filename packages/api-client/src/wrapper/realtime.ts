/**
 * Realtime subscriptions wrapper module.
 *
 * Returns a domain `Subscription { unsubscribe(): void }` so consumers
 * never see Supabase's `RealtimeChannel`. The channel is held internally
 * for `.on(...)` chaining; `unsubscribe()` tears down both the channel
 * and its registry entry on the underlying client.
 *
 * Note: apps that need fine-grained control over `.on(...)` chaining or
 * `subscribe(callback)` status events fall back to the raw `supabase`
 * client (CLAUDE.md Exception 1). The wrapper covers the common
 * "subscribe to a table, invalidate cache" pattern.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { WrapperContext } from './types';

type PostgresChangeCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) => void;

type SubscribeStatusCallback = (status: string, err?: Error) => void;

/**
 * Domain-level subscription handle. Hides `RealtimeChannel` from
 * consumers so the wrapper's public surface stays provider-agnostic.
 */
export interface Subscription {
  unsubscribe(): void;
}

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

function toSubscription(ctx: WrapperContext, channel: RealtimeChannel): Subscription {
  return {
    unsubscribe: () => {
      try {
        channel.unsubscribe();
      } catch {
        // already torn down
      }
      try {
        ctx.client.removeChannel(channel);
      } catch {
        // already evicted from registry
      }
    },
  };
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

  function normalizeOptions(
    callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
    onError?: SubscribeStatusCallback,
  ): RealtimeSubscribeOptions {
    return typeof callbackOrOptions === 'function'
      ? { callback: callbackOrOptions, onError }
      : callbackOrOptions;
  }

  return {
    subscribeToTables: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): Subscription => {
      const opts = normalizeOptions(callbackOrOptions, onError);
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('tables-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables', filter },
          opts.callback,
        );
      subscribeWithErrorHandler(channel, opts.onError);
      return toSubscription(ctx, channel);
    },

    subscribeToOrders: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): Subscription => {
      const opts = normalizeOptions(callbackOrOptions, onError);
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter },
          opts.callback,
        );
      subscribeWithErrorHandler(channel, opts.onError);
      return toSubscription(ctx, channel);
    },

    subscribeToWaiterCalls: (
      callbackOrOptions: PostgresChangeCallback | RealtimeSubscribeOptions,
      onError?: SubscribeStatusCallback,
    ): Subscription => {
      const opts = normalizeOptions(callbackOrOptions, onError);
      const filter = buildFilter(opts.tenantId);
      const channel = ctx.client
        .channel('waiter-calls-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls', filter },
          opts.callback,
        );
      subscribeWithErrorHandler(channel, opts.onError);
      return toSubscription(ctx, channel);
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
