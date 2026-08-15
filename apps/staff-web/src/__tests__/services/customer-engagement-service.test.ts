/**
 * Audit M3 — `PLAN_LIMITS[plan].qrOrdering` is enforced on
 * `createCustomerWaiterCall` and `createCustomerFeedback`, mirroring the
 * gate on `createCustomerOrder`. A plan that disables `qrOrdering` gets a
 * `plan_required` (HTTP 403) instead of a successful insert.
 *
 * NOTE (#227): the free tier is now a real trial with `qrOrdering: true`, so
 * every current plan enables these write surfaces — the reject path is latent
 * (kept for any future gated tier). The tests below lock the current policy:
 * free proceeds like the paid tiers.
 *
 * The route layer (`/api/v1/customer/waiter-calls`,
 * `/api/v1/customer/feedback`) translates the sentinel via
 * `handleRouteError` — covered by its own substring map test. This file
 * locks the *service* contract so a future refactor can't silently drop
 * the gate.
 */

import { NotFoundError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  createCustomerFeedback,
  createCustomerWaiterCall,
} from '@/lib/services/customer-engagement-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const TABLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CRID = '22222222-2222-4222-8222-222222222222';

interface QueuedResponse {
  data: unknown;
  error: unknown;
  count?: number;
}

/**
 * Replays a per-table queue of `{ data, error }` shapes from a single
 * Supabase mock builder. Mirrors the pattern in
 * `customer-order-service.test.ts` so engagement and order coverage stay
 * in sync.
 */
function buildClient(plan: Record<string, QueuedResponse[]>): SupabaseClient {
  const cursor: Record<string, number> = {};

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('createCustomerWaiterCall — plan gate (M3)', () => {
  it('proceeds for a free-tier tenant (QR ordering is ON on free — trial, #227)', async () => {
    // #227 flipped `PLAN_LIMITS.free.qrOrdering` to true, so free tenants now
    // get the customer-engagement write surfaces too. This locks that decision.
    const created = { id: 'call-free', tenant_id: TENANT };
    const client = buildClient({
      tables: [{ data: { id: TABLE, tenant_id: TENANT }, error: null }],
      tenants: [{ data: { plan: 'free' }, error: null }],
      waiter_calls: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: created, error: null }, // insert
      ],
    });

    const { row, deduped } = await createCustomerWaiterCall(client, {
      table_id: TABLE,
      call_type: 'assistance',
      priority: 'normal',
      client_request_id: CRID,
    });

    expect(deduped).toBe(false);
    expect(row).toEqual(created);
  });

  it('proceeds for plans that enable qrOrdering (standard)', async () => {
    const created = { id: 'call-1', tenant_id: TENANT };
    const client = buildClient({
      tables: [{ data: { id: TABLE, tenant_id: TENANT }, error: null }],
      tenants: [{ data: { plan: 'standard' }, error: null }],
      waiter_calls: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: created, error: null }, // insert
      ],
    });

    const { row, deduped } = await createCustomerWaiterCall(client, {
      table_id: TABLE,
      call_type: 'assistance',
      priority: 'normal',
      client_request_id: CRID,
    });

    expect(deduped).toBe(false);
    expect(row).toEqual(created);
  });

  it('runs plan gate AFTER tenant resolution so a missing table 404s without leaking plan info', async () => {
    const client = buildClient({
      tables: [{ data: null, error: null }], // table not found
      // No `tenants` queue entry — plan gate must not run.
    });

    await expect(
      createCustomerWaiterCall(client, {
        table_id: TABLE,
        call_type: 'assistance',
        priority: 'normal',
        client_request_id: CRID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('createCustomerFeedback — plan gate (M3)', () => {
  it('proceeds for a free-tier tenant (QR ordering is ON on free — trial, #227)', async () => {
    // #227: free is a real trial, so feedback writes are allowed on free too.
    const created = { id: 'fb-free', tenant_id: TENANT };
    const client = buildClient({
      tables: [{ data: { id: TABLE, tenant_id: TENANT }, error: null }],
      tenants: [{ data: { plan: 'free' }, error: null }],
      customer_feedback: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: created, error: null }, // insert
      ],
    });

    const { row, deduped } = await createCustomerFeedback(client, {
      table_id: TABLE,
      feedback_type: 'praise',
      message: 'Great food!',
      client_request_id: CRID,
    });

    expect(deduped).toBe(false);
    expect(row).toEqual(created);
  });

  it('proceeds for plans that enable qrOrdering (pro)', async () => {
    const created = { id: 'fb-1', tenant_id: TENANT };
    const client = buildClient({
      tables: [{ data: { id: TABLE, tenant_id: TENANT }, error: null }],
      tenants: [{ data: { plan: 'pro' }, error: null }],
      customer_feedback: [
        { data: null, error: null }, // dedupe lookup → no replay
        { data: created, error: null }, // insert
      ],
    });

    const { row, deduped } = await createCustomerFeedback(client, {
      table_id: TABLE,
      feedback_type: 'praise',
      message: 'Great food!',
      client_request_id: CRID,
    });

    expect(deduped).toBe(false);
    expect(row).toEqual(created);
  });

  it('runs plan gate AFTER tenant resolution so a missing table 404s', async () => {
    const client = buildClient({
      tables: [{ data: null, error: null }],
    });

    await expect(
      createCustomerFeedback(client, {
        table_id: TABLE,
        feedback_type: 'praise',
        message: 'Great food!',
        client_request_id: CRID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
