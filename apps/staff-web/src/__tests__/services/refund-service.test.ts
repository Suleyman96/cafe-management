/**
 * Refund-service guards.
 *
 * The pre-fix `createRefund` performed two un-locked SELECTs (`order_payments`
 * and `refunds`) and compared the available balance against the requested
 * amount before inserting. Under READ COMMITTED a concurrent payment between
 * those reads could let the comparison pass while the BEFORE-INSERT trigger
 * `validate_refund_amount` correctly rejected the row, surfacing a 5xx
 * instead of a typed 409. The pre-check was dropped — the trigger is the
 * sole authority on balance — and these tests pin the post-drop contract:
 *
 *   1. The service no longer issues `order_payments` / pre-check `refunds`
 *      SELECTs in the create path.
 *   2. A trigger-raised `refund_exceeds_available` (ERRCODE='check_violation',
 *      code='23514') becomes a typed `ConflictError(409)` via
 *      `handleSupabaseError`, not a generic 5xx.
 *   3. A 23505 unique-violation (concurrent replay) bubbles raw so the
 *      `findOrCreateByClientRequestId` helper can recover by refetching the
 *      race winner. Wrapping into ConflictError would erase the PG code and
 *      defeat the dedupe race-recovery.
 *   4. An order missing in the caller's tenant returns NotFoundError (404)
 *      via the PGRST116 path, not a downstream trigger rejection.
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`); this
 * service no longer reads `callerRole` and admin/owner is assumed.
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

interface CapturedInsert {
  table: string;
  payload: Record<string, unknown>;
}

function buildClient(plan: Record<string, QueuedResponse[]>) {
  const cursor: Record<string, number> = {};
  const inserts: CapturedInsert[] = [];
  const tableHits: string[] = [];

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  const client = {
    from: (table: string) => {
      tableHits.push(table);
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.insert = (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient & {
    __inserts: CapturedInsert[];
    __tableHits: string[];
  };

  (client as unknown as { __inserts: CapturedInsert[] }).__inserts = inserts;
  (client as unknown as { __tableHits: string[] }).__tableHits = tableHits;
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

describe('createRefund — drops pre-check and trusts the trigger', () => {
  it('does not query order_payments in the create path', async () => {
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID }, error: null }],
      refunds: [
        { data: null, error: null }, // dedupe lookup miss
        { data: REFUND_ROW, error: null }, // INSERT success
      ],
    });

    await createRefund(client, {
      orderId: ORDER_ID,
      refundData: REFUND_INPUT,
      tenantId: TENANT,
    });

    const tableHits = (client as unknown as { __tableHits: string[] }).__tableHits;
    expect(tableHits).not.toContain('order_payments');
    // Two `refunds` hits — the dedupe lookup + the INSERT. Still no
    // pre-check SELECT against `order_payments`.
    expect(tableHits.filter((t) => t === 'refunds')).toHaveLength(2);
  });

  it('returns the inserted refund row on success', async () => {
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID }, error: null }],
      refunds: [
        { data: null, error: null }, // dedupe lookup miss
        { data: REFUND_ROW, error: null }, // INSERT success
      ],
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: REFUND_INPUT,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(false);
    expect(result.refund).toMatchObject({ id: REFUND_ID, amount: 30 });

    const inserts = (client as unknown as { __inserts: CapturedInsert[] }).__inserts;
    const refundInsert = inserts.find((i) => i.table === 'refunds');
    expect(refundInsert).toBeDefined();
    expect(refundInsert!.payload).toMatchObject({
      order_id: ORDER_ID,
      tenant_id: TENANT,
      amount: 30,
      reason: 'Customer complaint',
      refund_method: 'cash',
    });
  });
});

describe('createRefund — trigger-rejected balance maps to ConflictError(409)', () => {
  it('translates check_violation `refund_exceeds_available` to a typed ConflictError', async () => {
    // The BEFORE-INSERT trigger raises `refund_exceeds_available` with
    // ERRCODE='check_violation' (PG code 23514) when paid - refunded < amount.
    // `handleSupabaseError` must turn that into ConflictError so the route
    // returns 409 with the sentinel as the error code, not a generic 500.
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID }, error: null }],
      refunds: [
        { data: null, error: null }, // dedupe lookup miss
        {
          data: null,
          error: { code: '23514', message: 'refund_exceeds_available' },
        },
      ],
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
      orders: [{ data: { id: ORDER_ID }, error: null }],
      refunds: [
        { data: null, error: null }, // dedupe lookup miss
        {
          data: null,
          error: { code: '23514', message: 'refund_tenant_mismatch' },
        },
      ],
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
  it('throws NotFoundError when the order is missing in the caller’s tenant', async () => {
    // .single() with 0 rows returns PGRST116, which handleSupabaseError maps
    // to NotFoundError. Cross-tenant access surfaces as 404 (not-found in
    // this tenant) instead of leaking existence via 403.
    const client = buildClient({
      refunds: [{ data: null, error: null }], // dedupe lookup miss
      orders: [{ data: null, error: { code: 'PGRST116', message: 'no rows' } }],
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

    // No INSERT should have been attempted.
    const inserts = (client as unknown as { __inserts: CapturedInsert[] }).__inserts;
    expect(inserts.find((i) => i.table === 'refunds')).toBeUndefined();
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
  });
});

describe('createRefund — client_request_id dedupe', () => {
  it('short-circuits and returns deduped=true when the client_request_id is already inserted', async () => {
    // A prior call with the same client_request_id already wrote a refund.
    // The helper finds it via the partial-unique index lookup and returns
    // early — no order verification, no INSERT, no audit-log re-entry.
    const client = buildClient({
      refunds: [{ data: REFUND_ROW, error: null }],
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: { ...REFUND_INPUT, client_request_id: 'req-replay-1' },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.refund).toMatchObject({ id: REFUND_ID });

    const tableHits = (client as unknown as { __tableHits: string[] }).__tableHits;
    expect(tableHits).not.toContain('orders');
    const inserts = (client as unknown as { __inserts: CapturedInsert[] }).__inserts;
    expect(inserts.find((i) => i.table === 'refunds')).toBeUndefined();
  });

  it('treats a 23505 unique-violation on the INSERT as a successful dedupe race', async () => {
    // Concurrency scenario: replay #1 commits with client_request_id=X.
    // Replay #2 misses the pre-INSERT lookup (race window) and tries to
    // insert. The partial unique index on (tenant_id, client_request_id)
    // rejects it with 23505. The helper must catch the raw PG code, refetch
    // the race winner, and return deduped=true rather than surface a 409.
    //
    // The service deliberately does NOT wrap 23505 into ConflictError —
    // doing so would change err.code to 'CONFLICT' and defeat the helper's
    // race-recovery branch.
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID }, error: null }],
      refunds: [
        // 1) dedupe lookup misses — race window
        { data: null, error: null },
        // 2) INSERT loses the race — the other replay's row was committed
        //    between our lookup and our insert
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // 3) helper's race-recovery refetch returns the winner
        { data: REFUND_ROW, error: null },
      ],
    });

    const result = await createRefund(client, {
      orderId: ORDER_ID,
      refundData: { ...REFUND_INPUT, client_request_id: 'req-concurrent-replay' },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.refund).toMatchObject({ id: REFUND_ID });
  });
});
