import { describe, expect, it, vi } from 'vitest';
import { createRealtimeWrapper } from '../wrapper/realtime';
import { createMockContext } from './helpers/mock-supabase';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('RealtimeWrapper', () => {
  it('subscribeToTables returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const sub = realtime.subscribeToTables({ callback: vi.fn(), tenantId: TENANT_ID });
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].table).toBe('__channel');
    expect(ctx.getCalls()[0].args[0]).toBe('tables-changes');
  });

  it('subscribeToOrders returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const sub = realtime.subscribeToOrders({ callback: vi.fn(), tenantId: TENANT_ID });
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].args[0]).toBe('orders-changes');
  });

  it('subscribeToWaiterCalls returns a Subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const sub = realtime.subscribeToWaiterCalls({ callback: vi.fn(), tenantId: TENANT_ID });
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    expect(ctx.getCalls()[0].args[0]).toBe('waiter-calls-changes');
  });

  it('Subscription.unsubscribe removes channel from client registry', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const sub = realtime.subscribeToTables({ callback: vi.fn(), tenantId: TENANT_ID });
    sub.unsubscribe();
    const calls = ctx.getCalls();
    const removeCall = calls.find((c: { method: string }) => c.method === 'removeChannel');
    expect(removeCall).toBeDefined();
  });

  it('throws when tenantId is an empty string (defense-in-depth)', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    expect(() => realtime.subscribeToOrders({ callback: vi.fn(), tenantId: '' })).toThrow(
      /tenantId is required/,
    );
  });

  it('throws when tenantId is missing (runtime guard against TS bypass)', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    // Cast through unknown to simulate a JS caller bypassing the type.
    const subscribeAsLoose = realtime.subscribeToTables as unknown as (opts: {
      callback: () => void;
    }) => unknown;
    expect(() => subscribeAsLoose({ callback: vi.fn() })).toThrow(/tenantId is required/);
  });

  it('embeds tenant_id filter in the postgres_changes subscription', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    realtime.subscribeToOrders({ callback: vi.fn(), tenantId: TENANT_ID });
    const onCall = ctx.getCalls().find((c: { method: string }) => c.method === 'on');
    expect(onCall).toBeDefined();
    const config = onCall!.args[1] as { filter?: string };
    expect(config.filter).toBe(`tenant_id=eq.${TENANT_ID}`);
  });

  it('subscribeUnsafe.orders builds a subscription without a tenant filter', () => {
    const ctx = createMockContext();
    const realtime = createRealtimeWrapper(ctx);
    const sub = realtime.subscribeUnsafe.orders({ callback: vi.fn() });
    expect(sub).toBeDefined();
    const onCall = ctx.getCalls().find((c: { method: string }) => c.method === 'on');
    expect(onCall).toBeDefined();
    const config = onCall!.args[1] as { filter?: string };
    expect(config.filter).toBeUndefined();
  });
});
