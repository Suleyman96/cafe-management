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
 *
 * Tenant safety: `tenantId` is REQUIRED on every subscribe call and is
 * compiled into the postgres_changes filter as `tenant_id=eq.<id>`. If a
 * caller genuinely needs a cross-tenant subscription (e.g. an internal
 * audit listener running with elevated privileges), use `subscribeUnsafe`,
 * which is intentionally named to make the omission visible at the call
 * site and in code review.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { WrapperContext } from './types';

type PostgresChangeCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) => void;

type SubscribeStatusCallback = (status: string, err?: Error) => void;

type RealtimeTable = 'tables' | 'orders' | 'waiter_calls';

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
  tenantId: string;
  onError?: SubscribeStatusCallback;
}

export interface RealtimeSubscribeUnsafeOptions {
  callback: PostgresChangeCallback;
  onError?: SubscribeStatusCallback;
}

export function createRealtimeWrapper(ctx: WrapperContext) {
  function assertTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error(
        'realtime.subscribe: tenantId is required. Use subscribeUnsafe for cross-tenant subscriptions.',
      );
    }
  }

  function buildSubscription(
    table: RealtimeTable,
    channelName: string,
    opts: RealtimeSubscribeOptions,
  ): Subscription {
    assertTenantId(opts.tenantId);
    const channel = ctx.client.channel(channelName).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${opts.tenantId}`,
      },
      opts.callback,
    );
    subscribeWithErrorHandler(channel, opts.onError);
    return toSubscription(ctx, channel);
  }

  function buildUnsafeSubscription(
    table: RealtimeTable,
    channelName: string,
    opts: RealtimeSubscribeUnsafeOptions,
  ): Subscription {
    const channel = ctx.client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, opts.callback);
    subscribeWithErrorHandler(channel, opts.onError);
    return toSubscription(ctx, channel);
  }

  return {
    subscribeToTables: (opts: RealtimeSubscribeOptions): Subscription =>
      buildSubscription('tables', 'tables-changes', opts),

    subscribeToOrders: (opts: RealtimeSubscribeOptions): Subscription =>
      buildSubscription('orders', 'orders-changes', opts),

    subscribeToWaiterCalls: (opts: RealtimeSubscribeOptions): Subscription =>
      buildSubscription('waiter_calls', 'waiter-calls-changes', opts),

    /**
     * Cross-tenant subscription escape hatch. Skips the `tenant_id` filter
     * entirely. Intended only for internal/elevated-privilege contexts
     * (e.g. backend audit listeners). Avoid in app code — RLS still
     * applies, but the firehose volume is not what client UIs want.
     */
    subscribeUnsafe: {
      tables: (opts: RealtimeSubscribeUnsafeOptions): Subscription =>
        buildUnsafeSubscription('tables', 'tables-changes-unsafe', opts),
      orders: (opts: RealtimeSubscribeUnsafeOptions): Subscription =>
        buildUnsafeSubscription('orders', 'orders-changes-unsafe', opts),
      waiterCalls: (opts: RealtimeSubscribeUnsafeOptions): Subscription =>
        buildUnsafeSubscription('waiter_calls', 'waiter-calls-changes-unsafe', opts),
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
