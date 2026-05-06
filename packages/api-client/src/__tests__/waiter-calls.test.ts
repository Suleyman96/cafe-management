import { ConflictError, NotFoundError } from '@gustri/core';
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

  // ── Plan 1 (acknowledge/resolve idempotency) ──────────────────────────────
  describe('acknowledge idempotency', () => {
    it('writes acknowledged_client_request_id when supplied', async () => {
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
      await waiterCalls.acknowledge(validCall.id, 'staff-123', {
        clientRequestId: '11111111-1111-4111-8111-111111111111',
      });
      const updateCall = ctx.getCalls().find((c: any) => c.method === 'update');
      expect(updateCall.args[0]).toMatchObject({
        responded_by: 'staff-123',
        acknowledged_client_request_id: '11111111-1111-4111-8111-111111111111',
      });
    });

    it('omits acknowledged_client_request_id when not supplied (legacy callers)', async () => {
      const acknowledgedCall = { ...validCall, status: 'acknowledged' };
      const ctx = createMockContext({
        responses: { waiter_calls: { data: acknowledgedCall, error: null } },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      await waiterCalls.acknowledge(validCall.id, 'staff-123');
      const updateCall = ctx.getCalls().find((c: any) => c.method === 'update');
      expect(updateCall.args[0]).not.toHaveProperty('acknowledged_client_request_id');
    });

    it('maps trigger sentinel waiter_call_already_acknowledged to ConflictError', async () => {
      const ctx = createMockContext({
        responses: {
          waiter_calls: {
            data: null,
            error: { code: 'P0002', message: 'waiter_call_already_acknowledged' },
          },
        },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      await expect(
        waiterCalls.acknowledge(validCall.id, 'staff-456', {
          clientRequestId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('passes through other P0002 errors as NotFoundError (existing semantics)', async () => {
      const ctx = createMockContext({
        responses: {
          waiter_calls: {
            data: null,
            error: { code: 'P0002', message: 'some_other_sentinel' },
          },
        },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      await expect(waiterCalls.acknowledge(validCall.id, 'staff-456')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('resolve idempotency', () => {
    it('writes resolved_client_request_id and notes when supplied', async () => {
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
      await waiterCalls.resolve(validCall.id, {
        notes: 'Customer left',
        clientRequestId: '33333333-3333-4333-8333-333333333333',
      });
      const updateCall = ctx.getCalls().find((c: any) => c.method === 'update');
      expect(updateCall.args[0]).toMatchObject({
        notes: 'Customer left',
        resolved_client_request_id: '33333333-3333-4333-8333-333333333333',
      });
    });

    it('still works without opts (legacy callers)', async () => {
      const resolvedCall = { ...validCall, status: 'resolved' };
      const ctx = createMockContext({
        responses: { waiter_calls: { data: resolvedCall, error: null } },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      const result = await waiterCalls.resolve(validCall.id);
      expect(result.status).toBe('resolved');
    });

    it('maps trigger sentinel waiter_call_already_resolved to ConflictError', async () => {
      const ctx = createMockContext({
        responses: {
          waiter_calls: {
            data: null,
            error: { code: 'P0002', message: 'waiter_call_already_resolved' },
          },
        },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      await expect(
        waiterCalls.resolve(validCall.id, {
          clientRequestId: '44444444-4444-4444-8444-444444444444',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // Plan 10 — replay-since-checkpoint catchup. waiter_calls has no
  // `updated_at` column, so the wrapper filters on `created_at` which is
  // the right semantic anyway: the audio surface only fires on INSERT
  // (a fresh call asking for assistance), not on acknowledge/resolve
  // UPDATEs.
  describe('findCreatedSince (Plan 10 catchup)', () => {
    type MockCall = { table: string; method: string; args: unknown[] };

    it('filters on created_at > since with the default 200 cap', async () => {
      const ctx = createMockContext({
        responses: { waiter_calls: { data: [validCall], error: null } },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      const since = new Date('2026-05-05T12:00:00.000Z');
      const result = await waiterCalls.findCreatedSince(since);
      expect(result).toEqual([validCall]);

      const calls = ctx.getCalls() as MockCall[];
      const gtCall = calls.find((c: MockCall) => c.method === 'gt');
      const limitCall = calls.find((c: MockCall) => c.method === 'limit');
      const orderCall = calls.find((c: MockCall) => c.method === 'order');
      expect(gtCall?.args).toEqual(['created_at', since.toISOString()]);
      expect(limitCall?.args).toEqual([200]);
      expect(orderCall?.args[0]).toBe('created_at');
    });

    it('honors a custom limit', async () => {
      const ctx = createMockContext({
        responses: { waiter_calls: { data: [], error: null } },
      });
      const waiterCalls = createWaiterCallsWrapper(ctx);
      await waiterCalls.findCreatedSince(new Date(0), { limit: 25 });
      const limitCall = (ctx.getCalls() as MockCall[]).find((c: MockCall) => c.method === 'limit');
      expect(limitCall?.args).toEqual([25]);
    });
  });
});
