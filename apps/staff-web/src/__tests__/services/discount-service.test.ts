/**
 * Discount-service guards.
 *
 * Pre-Blocker-6, `applyDiscount` ran the orders UPDATE and the
 * `discount_applied` financial_audit_log INSERT as two separate Supabase
 * round trips, so a failed audit insert would leave the discount applied
 * but uncatalogued (with a `console.warn` "best-effort" branch as the
 * only trace). Blocker 6 moves both writes into a single Postgres
 * function `apply_discount_with_audit` so the pair commits atomically.
 *
 * What stayed in the service:
 *  • Sanity caps (percentage 0–100, fixed ≤ subtotal, large-discount
 *    reason requirement) — they need an order read for context and
 *    produce structured `fieldErrors` for the UI.
 *  • Clamp-to-0 when type='none' so a stale UI value can't reactivate.
 *  • client_request_id required check (Blocker 1, defense-in-depth).
 *  • Tenant scope check (cross-tenant order_id → 404).
 *
 * What moved to the RPC: dedupe lookup, order lock, UPDATE, audit
 * INSERT — all atomic.
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`).
 */

import { NotFoundError, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { applyDiscount } from '@/lib/services/discount-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const CRID = '99999999-9999-4999-8999-999999999999';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

interface CapturedRpc {
  name: string;
  args: Record<string, unknown>;
}

function buildClient(plan: {
  rpc?: Record<string, QueuedResponse[]>;
  table?: Record<string, QueuedResponse[]>;
}) {
  const rpcCursor: Record<string, number> = {};
  const tableCursor: Record<string, number> = {};
  const rpcCalls: CapturedRpc[] = [];

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
  } as unknown as SupabaseClient & { __rpcCalls: CapturedRpc[] };

  (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls = rpcCalls;
  return client;
}

const ORDER_AFTER_DISCOUNT = {
  id: ORDER_ID,
  subtotal: 100,
  tax: 9,
  total: 99,
  discount_type: 'percentage',
  discount_value: 10,
  discount_amount: 10,
};

describe('applyDiscount — sanity validation runs before the RPC', () => {
  it('rejects when fraction >= DISCOUNT_AUDIT_THRESHOLD and reason is empty', async () => {
    // Service issues only the tenant-scope SELECT before throwing.
    // No RPC round trip should happen.
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
    });

    let caught: unknown;
    try {
      await applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 30, // 30% > 20% threshold
        discountReason: '',
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    const err = caught as ValidationError;
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('discount_reason_required');
    expect(err.details).toMatchObject({
      fieldErrors: { discount_reason: expect.any(String) },
    });

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(0);
  });

  it('rejects when reason is shorter than 5 characters (after trim)', async () => {
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
    });

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'fixed',
        discountValue: 50, // 50/100 = 50% > 20% threshold
        discountReason: '   ok ', // trims to 'ok' (2 chars)
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects with ValidationError when no clientRequestId is supplied', async () => {
    const client = buildClient({});

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10,
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(0);
  });
});

describe('applyDiscount — RPC happy path', () => {
  it('clamps discount_value to 0 when type is "none" before invoking the RPC', async () => {
    // Even when caller sends a negative discount_value, type='none' must
    // forward 0 to the RPC. Defense against a stale UI flipping back to
    // 'fixed' later and reactivating the negative.
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          {
            data: {
              order: {
                id: ORDER_ID,
                subtotal: 100,
                tax: 18,
                total: 118,
                discount_type: 'none',
                discount_value: 0,
                discount_amount: 0,
              },
              deduped: false,
            },
            error: null,
          },
        ],
      },
    });

    await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'none',
      discountValue: -1000,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: CRID,
    });

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'apply_discount_with_audit',
      args: {
        p_order_id: ORDER_ID,
        p_tenant_id: TENANT,
        p_discount_type: 'none',
        p_discount_value: 0,
        p_client_request_id: CRID,
      },
    });
  });

  it('forwards a valid large discount with reason and returns the updated order', async () => {
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          {
            data: {
              order: {
                id: ORDER_ID,
                subtotal: 100,
                tax: 18,
                total: 88,
                discount_type: 'percentage',
                discount_value: 30,
                discount_amount: 30,
              },
              deduped: false,
            },
            error: null,
          },
        ],
      },
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 30,
      discountReason: 'Customer complaint - cold food',
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: CRID,
    });

    expect(result.deduped).toBe(false);
    expect(result.order).toMatchObject({
      discount_type: 'percentage',
      discount_value: 30,
    });

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls[0]!.args).toMatchObject({
      p_discount_reason: 'Customer complaint - cold food',
    });
  });

  it('returns deduped=true when the RPC reports a replay short-circuit', async () => {
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          { data: { order: ORDER_AFTER_DISCOUNT, deduped: true }, error: null },
        ],
      },
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: CRID,
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toMatchObject({ discount_type: 'percentage', discount_value: 10 });
  });
});

describe('applyDiscount — concurrent dedupe race recovery', () => {
  it('refetches and returns deduped=true on 23505 from the RPC (audit-index race-loser path)', async () => {
    // Two replays both miss the RPC's pre-INSERT lookup. One wins on the
    // partial unique index for `discount_applied`; the loser raises
    // 23505. The service catches it, refetches the order, and returns
    // deduped=true rather than surfacing a 5xx. Because the audit INSERT
    // and the orders UPDATE share a transaction inside the RPC, the
    // loser's UPDATE is rolled back too — the refetched row reflects the
    // winner's commit, which (UPDATE being idempotent on absolute
    // values) is the correct shared state.
    const client = buildClient({
      table: {
        orders: [
          // 1) tenant verification SELECT
          { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
          // 2) refetch after 23505
          { data: ORDER_AFTER_DISCOUNT, error: null },
        ],
      },
      rpc: {
        apply_discount_with_audit: [
          { data: null, error: { code: '23505', message: 'duplicate key value' } },
        ],
      },
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: 'req-concurrent-replay',
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toMatchObject({
      discount_type: 'percentage',
      discount_value: 10,
    });
  });

  it('propagates a non-unique-violation RPC error as a typed AppError (no best-effort branch)', async () => {
    // The pre-Blocker-6 service had a `console.warn` "best-effort"
    // branch that swallowed non-23505 audit errors and returned the
    // (already-applied) discount. With the RPC, the audit INSERT and
    // orders UPDATE are atomic — any RPC error means *neither* committed,
    // so we must propagate the error so the route returns a non-200 and
    // the caller can retry safely.
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          { data: null, error: { code: '42501', message: 'permission denied' } },
        ],
      },
    });

    let caught: unknown;
    try {
      await applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10,
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      });
    } catch (err) {
      caught = err;
    }

    // 42501 → AuthorizationError(403) via handleSupabaseError.
    expect(caught).toBeDefined();
    expect((caught as { statusCode?: number }).statusCode).toBe(403);
  });
});

describe('applyDiscount — order existence and tenant scope', () => {
  it('throws NotFoundError when the order is missing in the caller’s tenant', async () => {
    // .single() with 0 rows returns PGRST116, which handleSupabaseError
    // maps to NotFoundError. No RPC round trip.
    const client = buildClient({
      table: {
        orders: [{ data: null, error: { code: 'PGRST116', message: 'no rows' } }],
      },
    });

    let caught: unknown;
    try {
      await applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10,
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).statusCode).toBe(404);

    const calls = (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
    expect(calls).toHaveLength(0);
  });

  it('translates RPC trigger sentinels to typed errors (refund_exceeds is for refunds; here the equivalent is order_not_found_in_tenant)', async () => {
    // This mirrors the analogous P0002 path on the refund RPC — included
    // so the discount RPC also has a contract test for the no_data_found
    // branch (e.g. concurrent close between the service's SELECT and the
    // RPC's lock acquire).
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          { data: null, error: { code: 'P0002', message: 'order_not_found_in_tenant' } },
        ],
      },
    });

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10,
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not require a reason when fraction is below the threshold', async () => {
    const client = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
      },
      rpc: {
        apply_discount_with_audit: [
          { data: { order: ORDER_AFTER_DISCOUNT, deduped: false }, error: null },
        ],
      },
    });

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10, // 10% < 20% threshold — no reason needed
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        clientRequestId: CRID,
      }),
    ).resolves.toBeDefined();
  });
});
