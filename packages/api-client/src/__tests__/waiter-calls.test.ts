import { describe, expect, it } from 'vitest';
import { createWaiterCallsWrapper } from '../wrapper/waiter-calls';
import { createMockContext } from './helpers/mock-supabase';

const validCall = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
  reason: 'Need assistance',
  status: 'pending',
  call_type: 'assistance',
  priority: 'normal',
  created_at: new Date().toISOString(),
};

describe('WaiterCallsWrapper', () => {
  it('create inserts with default status', async () => {
    const ctx = createMockContext({
      responses: {
        waiter_calls: { data: validCall, error: null },
      },
    });
    const waiterCalls = createWaiterCallsWrapper(ctx);
    const result = await waiterCalls.create({
      table_id: validCall.table_id,
      reason: 'Need assistance',
    });
    expect(result).toEqual(validCall);
    const calls = ctx.getCalls();
    expect(calls[0].method).toBe('insert');
  });

  it('findByTable filters by table and status', async () => {
    const ctx = createMockContext({
      responses: {
        waiter_calls: { data: [validCall], error: null },
      },
    });
    const waiterCalls = createWaiterCallsWrapper(ctx);
    const result = await waiterCalls.findByTable(validCall.table_id, 'pending');
    expect(result).toEqual([validCall]);
  });

  it('acknowledge sets acknowledged_at', async () => {
    const acknowledgedCall = {
      ...validCall,
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    };
    const ctx = createMockContext({
      responses: {
        waiter_calls: { data: acknowledgedCall, error: null },
      },
    });
    const waiterCalls = createWaiterCallsWrapper(ctx);
    const result = await waiterCalls.acknowledge(validCall.id, 'staff-123');
    expect(result.status).toBe('acknowledged');
  });

  it('resolve sets resolved_at', async () => {
    const resolvedCall = {
      ...validCall,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    };
    const ctx = createMockContext({
      responses: {
        waiter_calls: { data: resolvedCall, error: null },
      },
    });
    const waiterCalls = createWaiterCallsWrapper(ctx);
    const result = await waiterCalls.resolve(validCall.id);
    expect(result.status).toBe('resolved');
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        waiter_calls: { data: null, error: { code: 'PGRST301' } },
      },
    });
    const waiterCalls = createWaiterCallsWrapper(ctx);
    await expect(waiterCalls.findAll()).rejects.toThrow();
  });
});
