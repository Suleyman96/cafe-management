/**
 * C2 revenue-theft fix — server-side enforcement of order totals.
 *
 * The pre-fix flow let `POST /api/v1/orders` accept `subtotal`/`tax`/`total`
 * in the request body and persist them verbatim. A malicious staffer could
 * post real items with a $0.01 total and pocket the difference at the
 * register. The schema in `route.ts` now strips those fields, but as
 * defense-in-depth the service must also force them to zero on the insert
 * — so even if a future code path bypasses the schema, the DB cannot
 * receive a client-controlled total.
 *
 * The actual recompute happens in Postgres: the AFTER INSERT trigger on
 * `order_items` calls `calculate_order_total(order_id)` which rewrites the
 * orders row from the (now-snapshotted) item prices. This test only
 * verifies the server-side wrapper sends zeros to the DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createOrder } from '@/lib/services/order-service';

const TENANT = '11111111-1111-4111-8111-111111111111';

interface QueuedResponse {
  data: unknown;
  error: unknown;
  count?: number;
}

interface CapturedInsert {
  table: string;
  payload: Record<string, unknown>;
}

function buildClient(plan: Record<string, QueuedResponse[]>) {
  const cursor: Record<string, number> = {};
  const inserts: CapturedInsert[] = [];

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'update', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
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
  } as unknown as SupabaseClient & { __inserts: CapturedInsert[] };

  (client as unknown as { __inserts: CapturedInsert[] }).__inserts = inserts;
  return client;
}

const CRID = '88888888-8888-4888-8888-888888888888';

describe('createOrder service — totals are derived server-side (C2)', () => {
  it('overwrites client-supplied subtotal/tax/total with zeros on insert', async () => {
    // Even if the route's schema were bypassed, the service must scrub
    // these fields. The eventual total will be derived by the DB trigger
    // from order_items rows after they're inserted in a follow-up call.
    const fresh = { id: 'order-fresh', tenant_id: TENANT };
    const client = buildClient({
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null }, // dedupe lookup miss (Blocker 1)
        { data: null, error: null, count: 0 } as QueuedResponse, // monthly-count
        { data: fresh, error: null }, // insert
      ],
    });

    await createOrder(client, {
      orderData: {
        order_type: 'dine_in',
        table_id: 'tbl-1',
        // Spoofed by a malicious client — service must overwrite to zero.
        subtotal: 0.01,
        tax: 0.01,
        total: 0.01,
        client_request_id: CRID,
      } as Record<string, unknown>,
      tenantId: TENANT,
    });

    const inserts = (client as unknown as { __inserts: CapturedInsert[] }).__inserts;
    const orderInsert = inserts.find((i) => i.table === 'orders');
    expect(orderInsert).toBeDefined();
    expect(orderInsert!.payload.subtotal).toBe(0);
    expect(orderInsert!.payload.tax).toBe(0);
    expect(orderInsert!.payload.total).toBe(0);
    expect(orderInsert!.payload.tenant_id).toBe(TENANT);
  });

  it('forces zeros even when no totals are sent (defense in depth)', async () => {
    // The wrapper should set subtotal/tax/total = 0 unconditionally —
    // not just when the client tries to spoof them.
    const fresh = { id: 'order-fresh', tenant_id: TENANT };
    const client = buildClient({
      tenants: [{ data: { plan: 'pro' }, error: null }],
      orders: [
        { data: null, error: null }, // dedupe lookup miss (Blocker 1)
        { data: null, error: null, count: 0 } as QueuedResponse,
        { data: fresh, error: null },
      ],
    });

    await createOrder(client, {
      orderData: {
        order_type: 'dine_in',
        table_id: 'tbl-1',
        client_request_id: CRID,
      },
      tenantId: TENANT,
    });

    const inserts = (client as unknown as { __inserts: CapturedInsert[] }).__inserts;
    const orderInsert = inserts.find((i) => i.table === 'orders');
    expect(orderInsert!.payload.subtotal).toBe(0);
    expect(orderInsert!.payload.tax).toBe(0);
    expect(orderInsert!.payload.total).toBe(0);
  });
});
