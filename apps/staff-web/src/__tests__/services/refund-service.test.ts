/**
 * Refund-service guards.
 *
 * The pre-fix `createRefund` did the dedupe lookup and the refund INSERT
 * as two separate Supabase round trips (two transactions), with a JS-side
 * `findOrCreateByClientRequestId` helper handling the 23505 race-recovery
 * branch. Blocker 6 moves the lookup, order lock, INSERT, and audit-row
 * write into a single Postgres function `create_refund_with_audit` so
 * the four steps commit together. These tests pin the post-RPC contract:
 *
 *   1. The service issues exactly one `client.rpc('create_refund_with_audit', …)`
 *      call and returns the unwrapped jsonb response.
 *   2. The trigger-raised `refund_exceeds_available` (ERRCODE='check_violation',
 *      code='23514') still maps to a typed `ConflictError(409)` via
 *      `handleSupabaseError`.
 *   3. A 23505 unique-violation (concurrent replay losing the index race)
 *      is followed by a refetch and returned as `deduped: true`.
 *   4. P0002 `order_not_found_in_tenant` from the RPC maps to NotFoundError(404).
 *   5. Missing `client_request_id` raises ValidationError (Blocker 1).
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`).
 */

import { ConflictError, NotFoundError, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createRefund } from '@/lib/services/refund-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const REFUND_ID = '44444444-4444-4444-8444-444444444444';
const CRID = '55555555-5555-4555-8555-555555555555';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

interface CapturedRpc {
  name: string;
  args: Record<string, unknown>;
}

interface CapturedTableHit {
  table: string;
  op: 'select';
}

/**
 * Test client with two queues:
 *   - rpc[name]: queue of {data, error} for client.rpc(name, args) calls.
 *   - table[name]: queue of {data, error} for client.from(name).select().…
 *     terminator calls (.single() / .maybeSingle()).
 *
 * Captures every rpc call (name + args) and every from('…') hit so tests
 * can assert call shape.
 */
function buildClient(plan: {
  rpc?: Record<string, QueuedResponse[]>;
  table?: Record<string, QueuedResponse[]>;
}) {
  const rpcCursor: Record<string, number> = {};
  const tableCursor: Record<string, number> = {};
  const rpcCalls: CapturedRpc[] = [];
  const tableHits: CapturedTableHit[] = [];

  function nextRpc(name: string): QueuedResponse {
    const queue = plan.rpc?.[name] ?? [];
    const i = rpcCursor[name] ?? 0;
    rpcCursor[name] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected rpc ${name}[${i}]` } };
  }

  function nextTable(table: string): QueuedResponse {
    const queue = plan.table?.[table] ?? [];
    const i = tableCursor[table] ?? 0;
    tableCursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(nextRpc(name));
    },
    from: (table: string) => {
      tableHits.push({ table, op: 'select' });
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.single = () => Promise.resolve(nextTable(table));
      builder.maybeSingle = () => Promise.resolve(nextTable(table));
      return builder;
    },
  } as unknown as SupabaseClient & {
    __rpcCalls: CapturedRpc[];
    __tableHits: CapturedTableHit[];
  };

  (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls = rpcCalls;
  (client as unknown as { __tableHits: CapturedTableHit[] }).__tableHits = tableHits;
  return client;
}

const REFUND_ROW = {
  id: REFUND_ID,
  order_id: ORDER_ID,
  tenant_id: TENANT,
  amount: 30,
  reason: 'Customer complaint',
  refund_method: 'cash',
  processed_by: STAFF_ID,
  processed_by_staff: { full_name: 'Admin', role: 'admin' },
};

const REFUND_INPUT = {
  amount: 30,
  reason: 'Customer complaint',
  refund_method: 'cash',
  processed_by: STAFF_ID,
  client_request_id: CRID,
};

describe('createRefund — RPC happy path', () => {
  it('invokes create_refund_with_audit with the mapped argument names and returns the joined refund', async () => {
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [{ data: { refund: REFUND_ROW, deduped: false }, error: null }],
      },
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: REFUND_INPUT,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(false);
    expect(result.refund).toMatchObject({ id: REFUND_ID, amount: 30 });

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'create_refund_with_audit',
      args: {
        p_order_id: ORDER_ID,
        p_tenant_id: TENANT,
        p_amount: 30,
        p_reason: 'Customer complaint',
        p_refund_method: 'cash',
        p_processed_by: STAFF_ID,
        p_client_request_id: CRID,
      },
    });

    // No direct from('refunds') / from('orders') round trips — the RPC
    // does the lookup, lock, INSERT, and audit row write in one call.
    const tableHits = (client as unknown as { __tableHits: CapturedTableHit[] }).__tableHits;
    expect(tableHits).toHaveLength(0);
  });

  it('returns deduped=true when the RPC reports a replay short-circuit', async () => {
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [{ data: { refund: REFUND_ROW, deduped: true }, error: null }],
      },
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: { ...REFUND_INPUT, client_request_id: 'req-replay-1' },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.refund).toMatchObject({ id: REFUND_ID });
  });
});

describe('createRefund — trigger-rejected balance maps to ConflictError(409)', () => {
  it('translates check_violation `refund_exceeds_available` to a typed ConflictError', async () => {
    // The BEFORE-INSERT trigger raises `refund_exceeds_available` with
    // ERRCODE='check_violation' (PG code 23514). The error propagates
    // through the RPC to the client; `handleSupabaseError` maps it to
    // ConflictError so the route returns 409 with the sentinel as the
    // error code.
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [
          {
            data: null,
            error: { code: '23514', message: 'refund_exceeds_available' },
          },
        ],
      },
    });

    let caught: unknown;
    try {
      await createRefund(client, {
        orderId: ORDER_ID,
        refundData: REFUND_INPUT,
        tenantId: TENANT,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConflictError);
    const err = caught as ConflictError;
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('refund_exceeds_available');
  });

  it('translates check_violation `refund_tenant_mismatch` to a typed ConflictError', async () => {
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [
          {
            data: null,
            error: { code: '23514', message: 'refund_tenant_mismatch' },
          },
        ],
      },
    });

    await expect(
      createRefund(client, {
        orderId: ORDER_ID,
        refundData: REFUND_INPUT,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('createRefund — order existence and tenant scope', () => {
  it('throws NotFoundError when the RPC raises P0002 `order_not_found_in_tenant`', async () => {
    // The RPC does the order lookup + tenant verification under FOR UPDATE
    // and raises `RAISE EXCEPTION ... USING ERRCODE = 'no_data_found'`
    // (PG code P0002) when the order is missing or in a different tenant.
    // handleSupabaseError maps P0002 to NotFoundError so the route returns
    // 404 — cross-tenant access surfaces as not-found rather than leaking
    // existence via 403.
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [
          { data: null, error: { code: 'P0002', message: 'order_not_found_in_tenant' } },
        ],
      },
    });

    let caught: unknown;
    try {
      await createRefund(client, {
        orderId: ORDER_ID,
        refundData: REFUND_INPUT,
        tenantId: TENANT,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).statusCode).toBe(404);
  });
});

describe('createRefund — client_request_id is required (Blocker 1)', () => {
  it('rejects with ValidationError when no client_request_id is supplied', async () => {
    const client = buildClient({});

    const { client_request_id: _omit, ...rest } = REFUND_INPUT;
    void _omit;

    await expect(
      createRefund(client, {
        orderId: ORDER_ID,
        refundData: rest,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Should not have invoked the RPC at all — defense-in-depth fires
    // before any round trip.
    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(0);
  });
});

describe('createRefund — concurrent dedupe race recovery', () => {
  it('refetches the winning row when the RPC returns 23505 (race-loser path)', async () => {
    // Concurrency scenario: two replays land between the RPC's pre-INSERT
    // lookup and its INSERT. One wins on the (tenant_id, client_request_id)
    // unique index; the loser receives 23505. The service refetches by
    // request_id and returns the winner's row as deduped.
    const client = buildClient({
      rpc: {
        create_refund_with_audit: [
          { data: null, error: { code: '23505', message: 'duplicate key value' } },
        ],
      },
      table: {
        refunds: [{ data: REFUND_ROW, error: null }],
      },
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: { ...REFUND_INPUT, client_request_id: 'req-concurrent-replay' },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.refund).toMatchObject({ id: REFUND_ID });

    const tableHits = (client as unknown as { __tableHits: CapturedTableHit[] }).__tableHits;
    expect(tableHits.map((h) => h.table)).toContain('refunds');
  });
});
