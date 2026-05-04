/**
 * Dedupe-coverage tests for mutation routes that accept `client_request_id`.
 *
 * Mobile persists mutations via TanStack Query persister + retries them on
 * relaunch. If the original commit succeeded but the response was lost, the
 * replay must NOT create a duplicate side-effect row (payment, refund, stock
 * movement, audit log entry, …). Each covered service short-circuits when
 * the dedupe anchor is already present and returns the prior result.
 *
 * For the discount path the dedupe anchor is the
 * `financial_audit_log.details.client_request_id` JSON field, enforced by
 * the partial unique index `uq_financial_audit_discount_client_request`
 * (migration 20260504000002). Blocker 6 (migration 20260505000004) moved
 * the discount UPDATE and the audit INSERT into a single Postgres function
 * `apply_discount_with_audit`, so these tests now stub the RPC instead of
 * the table-builder chain.
 */

import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDiscount } from '@/lib/services/discount-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';

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
  } as unknown as SupabaseClient;

  return { client, rpcCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('discount-service — dedupe via apply_discount_with_audit RPC', () => {
  it('forwards client_request_id into the RPC args on first call', async () => {
    const { client, rpcCalls } = buildClient({
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
                total: 108,
                discount_type: 'percentage',
                discount_value: 10,
                discount_amount: 10,
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
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(false);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toMatchObject({
      name: 'apply_discount_with_audit',
      args: { p_client_request_id: CLIENT_REQUEST_ID, p_order_id: ORDER_ID, p_tenant_id: TENANT },
    });
  });

  it('returns deduped=true when the RPC reports a replay short-circuit', async () => {
    // The RPC's pre-INSERT lookup on the partial unique index
    // (tenant_id, action='discount_applied', client_request_id) finds
    // the prior audit row and returns the current order with
    // deduped=true — no second UPDATE, no second audit insert, all in
    // a single Postgres call.
    const { client } = buildClient({
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
                total: 108,
                discount_type: 'percentage',
                discount_value: 10,
                discount_amount: 10,
              },
              deduped: true,
            },
            error: null,
          },
        ],
      },
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toMatchObject({ id: ORDER_ID, discount_value: 10 });
  });

  it('omitting client_request_id rejects with ValidationError (Blocker 1)', async () => {
    // Pre-Blocker-1 the service quietly skipped dedupe when no key was
    // supplied. Now the call MUST carry a key — discounts are
    // financial-audit-log-anchored and a missing key is a programmer
    // error, not a fallback. The route schema also rejects, but we keep
    // a unit assertion at the service layer for defense-in-depth.
    const { client, rpcCalls } = buildClient({
      table: {
        orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
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
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(rpcCalls).toHaveLength(0);
  });
});
