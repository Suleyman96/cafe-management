import { describe, expect, it, vi } from 'vitest';
import { createRealtimeWrapper } from '../wrapper/realtime';
import { createMockContext } from './helpers/mock-supabase';

describe('RealtimeWrapper', () => {
  it('subscribeToTables returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const sub = realtime.subscribeToTables(callback);
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].table).toBe('__channel');
    expect(ctx.getCalls()[0].args[0]).toBe('tables-changes');
  });

  it('subscribeToOrders returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const sub = realtime.subscribeToOrders(callback);
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].args[0]).toBe('orders-changes');
  });

  it('subscribeToWaiterCalls returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const sub = realtime.subscribeToWaiterCalls(callback);
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].args[0]).toBe('waiter-calls-changes');
  });

  it('Subscription.unsubscribe removes channel from client registry', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const callback = vi.fn();
    const sub = realtime.subscribeToTables(callback);
    sub.unsubscribe();
    const calls = ctx.getCalls();
    const removeCall = calls.find((c: { method: string }) => c.method === 'removeChannel');
    expect(removeCall).toBeDefined();
  });
});
