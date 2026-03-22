import { describe, expect, it, vi } from 'vitest';
import { createRealtimeWrapper } from '../wrapper/realtime';
import { createMockContext } from './helpers/mock-supabase';

describe('RealtimeWrapper', () => {
  it('subscribeToTables creates a channel subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const channel = realtime.subscribeToTables(callback);
    expect(channel).toBeDefined();
    expect(ctx.getCalls()[0].table).toBe('__channel');
    expect(ctx.getCalls()[0].args[0]).toBe('tables-changes');
  });

  it('subscribeToOrders creates a channel subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const channel = realtime.subscribeToOrders(callback);
    expect(channel).toBeDefined();
    expect(ctx.getCalls()[0].args[0]).toBe('orders-changes');
  });

  it('subscribeToWaiterCalls creates a channel subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const channel = realtime.subscribeToWaiterCalls(callback);
    expect(channel).toBeDefined();
    expect(ctx.getCalls()[0].args[0]).toBe('waiter-calls-changes');
  });

  it('unsubscribe removes channel', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const channel = realtime.subscribeToTables(callback);
    realtime.unsubscribe(channel);
    const calls = ctx.getCalls();
    const removeCall = calls.find((c: { method: string }) => c.method === 'removeChannel');
    expect(removeCall).toBeDefined();
  });
});
