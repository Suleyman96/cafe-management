/**
 * Realtime subscriptions wrapper module
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { WrapperContext } from './types';

export function createRealtimeWrapper(ctx: WrapperContext) {
  return {
    subscribeToTables: (callback: (payload: any) => void) => {
      return ctx.client
        .channel('tables-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables' },
          callback
        )
        .subscribe();
    },

    subscribeToOrders: (callback: (payload: any) => void) => {
      return ctx.client
        .channel('orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          callback
        )
        .subscribe();
    },

    subscribeToWaiterCalls: (callback: (payload: any) => void) => {
      return ctx.client
        .channel('waiter-calls-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls' },
          callback
        )
        .subscribe();
    },

    unsubscribe: (channel: any) => {
      return ctx.client.removeChannel(channel);
    },
  };
}

export type RealtimeWrapper = ReturnType<typeof createRealtimeWrapper>;
