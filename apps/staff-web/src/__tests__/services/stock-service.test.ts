/**
 * stock-service guards.
 *
 * The pre-RPC implementation read `quantity`, computed `newQuantity` in JS,
 * and issued separate INSERT/UPDATE calls. Two concurrent "out" requests
 * could each see the same baseline and both UPDATE to the same target,
 * losing one decrement (lost-update under READ COMMITTED). Migration
 * 20260504000003 introduces `adjust_stock_atomic` — a SECURITY DEFINER
 * RPC that holds `SELECT … FOR UPDATE` and does the read-modify-write in
 * one transaction. These tests pin the service's contract with the RPC:
 *   1. The fast-path dedupe lookup short-circuits on
 *      `client_request_id` matches without ever calling the RPC.
 *   2. A 23505 from the RPC (concurrent attempts both missed the lookup)
 *      is treated as a successful dedupe.
 *   3. Domain errors RAISEd by the RPC are mapped back to the pre-RPC
 *      Error surface so route + UI behavior is unchanged.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { adjustStock } from '@/lib/services/stock-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const STOCK_ITEM_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

interface CapturedRpc {
  fn: string;
  args: Record<string, unknown>;
}

interface ClientPlan {
  tables?: Record<string, QueuedResponse[]>;
  rpc?: QueuedResponse[];
}

function buildClient(plan: ClientPlan) {
  const cursor: Record<string, number> = {};
  const rpcCalls: CapturedRpc[] = [];

  function next(table: string): QueuedResponse {
    const queue = plan.tables?.[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  let rpcCursor = 0;
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'in',
        'gte',
        'order',
        'limit',
      ]) {
        builder[m] = chain();
      }
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      const i = rpcCursor++;
      const queued = plan.rpc?.[i] ?? {
        data: null,
        error: { message: `unexpected rpc[${i}] ${fn}` },
      };
      return Promise.resolve(queued);
    },
  } as unknown as SupabaseClient & { __rpcCalls: CapturedRpc[] };

  (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls = rpcCalls;
  return client;
}

function getRpcCalls(client: SupabaseClient): CapturedRpc[] {
  return (client as unknown as { __rpcCalls: CapturedRpc[] }).__rpcCalls;
}

describe('adjustStock — fast-path dedupe via client_request_id', () => {
  it('skips the RPC entirely when a movement with this client_request_id already exists', async () => {
    const client = buildClient({
      tables: {
        // 1) lookup — HIT
        stock_movements: [{ data: { id: 'movement-prior' }, error: null }],
        // 2) refetch the current stock item to return to the caller
        stock_items: [
          {
            data: { id: STOCK_ITEM_ID, quantity: 90, tenant_id: TENANT, is_active: true },
            error: null,
          },
        ],
      },
    });

    const result = await adjustStock(client, {
      stockItemId: STOCK_ITEM_ID,
      data: {
        movement_type: 'out',
        quantity_change: 10,
        reason: 'spillage',
        performed_by: STAFF_ID,
        client_request_id: REQUEST_ID,
      },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.stockItem).toMatchObject({ id: STOCK_ITEM_ID, quantity: 90 });
    // The whole point: no RPC round-trip on the fast path.
    expect(getRpcCalls(client)).toHaveLength(0);
  });
});

describe('adjustStock — atomic RPC delegation', () => {
  it('forwards parameters to adjust_stock_atomic and returns the row from the RPC', async () => {
    const client = buildClient({
      tables: {
        // lookup MISSES — first attempt
        stock_movements: [{ data: null, error: null }],
      },
      rpc: [
        {
          data: { id: STOCK_ITEM_ID, quantity: 90, tenant_id: TENANT, is_active: true },
          error: null,
        },
      ],
    });

    const result = await adjustStock(client, {
      stockItemId: STOCK_ITEM_ID,
      data: {
        movement_type: 'out',
        quantity_change: 10,
        reason: 'spillage',
        performed_by: STAFF_ID,
        client_request_id: REQUEST_ID,
      },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(false);
    expect(result.stockItem).toMatchObject({ quantity: 90 });

    const rpcCalls = getRpcCalls(client);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('adjust_stock_atomic');
    expect(rpcCalls[0].args).toEqual({
      p_stock_item_id: STOCK_ITEM_ID,
      p_tenant_id: TENANT,
      p_movement_type: 'out',
      p_quantity_change: 10,
      p_reason: 'spillage',
      p_performed_by: STAFF_ID,
      p_client_request_id: REQUEST_ID,
    });
  });

  it('passes p_client_request_id=null when the caller did not provide one', async () => {
    const client = buildClient({
      rpc: [
        {
          data: { id: STOCK_ITEM_ID, quantity: 110, tenant_id: TENANT, is_active: true },
          error: null,
        },
      ],
    });

    await adjustStock(client, {
      stockItemId: STOCK_ITEM_ID,
      data: {
        movement_type: 'in',
        quantity_change: 10,
        reason: 'restock',
        performed_by: STAFF_ID,
      },
      tenantId: TENANT,
    });

    const rpcCalls = getRpcCalls(client);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_client_request_id).toBeNull();
  });
});

describe('adjustStock — concurrent-dedupe via 23505', () => {
  it('treats a 23505 from the RPC as a successful dedupe and refetches the row', async () => {
    // Race scenario: lookup misses (the other attempt has not yet inserted),
    // RPC INSERT loses the race on the (tenant_id, client_request_id) unique
    // index. The on-hand count was already adjusted by the other attempt,
    // so we must not retry — return the current row with deduped=true.
    const client = buildClient({
      tables: {
        // 1) lookup MISSES (race window)
        stock_movements: [{ data: null, error: null }],
        // 2) refetch after dedupe
        stock_items: [
          {
            data: { id: STOCK_ITEM_ID, quantity: 90, tenant_id: TENANT, is_active: true },
            error: null,
          },
        ],
      },
      rpc: [
        // RPC raises 23505 (other concurrent attempt won the race)
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
      ],
    });

    const result = await adjustStock(client, {
      stockItemId: STOCK_ITEM_ID,
      data: {
        movement_type: 'out',
        quantity_change: 10,
        reason: 'spillage',
        performed_by: STAFF_ID,
        client_request_id: REQUEST_ID,
      },
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.stockItem).toMatchObject({ quantity: 90 });
  });

  it('does not dedupe on 23505 when no client_request_id was supplied (would be ambiguous)', async () => {
    // 23505 without a client_request_id can't safely be interpreted as a
    // dedupe — there's no key to match against. Surface as a regular error.
    const client = buildClient({
      rpc: [{ data: null, error: { code: '23505', message: 'duplicate key value' } }],
    });

    await expect(
      adjustStock(client, {
        stockItemId: STOCK_ITEM_ID,
        data: {
          movement_type: 'out',
          quantity_change: 10,
          reason: 'spillage',
          performed_by: STAFF_ID,
        },
        tenantId: TENANT,
      }),
    ).rejects.toThrow('duplicate key value');
  });
});

describe('adjustStock — domain error mapping', () => {
  it('maps "Stock item not found" RAISE message to the pre-RPC Error string', async () => {
    const client = buildClient({
      rpc: [
        {
          data: null,
          error: { code: 'P0002', message: 'Stock item not found' },
        },
      ],
    });

    await expect(
      adjustStock(client, {
        stockItemId: STOCK_ITEM_ID,
        data: {
          movement_type: 'in',
          quantity_change: 5,
          reason: 'restock',
          performed_by: STAFF_ID,
        },
        tenantId: TENANT,
      }),
    ).rejects.toThrow('Stock item not found');
  });

  it('maps "Stock item tenant mismatch" to the same not-found surface (caller leaks no info)', async () => {
    const client = buildClient({
      rpc: [
        {
          data: null,
          error: { code: '42501', message: 'Stock item tenant mismatch' },
        },
      ],
    });

    await expect(
      adjustStock(client, {
        stockItemId: STOCK_ITEM_ID,
        data: {
          movement_type: 'in',
          quantity_change: 5,
          reason: 'restock',
          performed_by: STAFF_ID,
        },
        tenantId: TENANT,
      }),
    ).rejects.toThrow('Stock item not found');
  });

  it('maps "Insufficient stock" RAISE message to the pre-RPC Error string', async () => {
    const client = buildClient({
      rpc: [
        {
          data: null,
          error: {
            code: '23514',
            message: 'Insufficient stock for this adjustment',
          },
        },
      ],
    });

    await expect(
      adjustStock(client, {
        stockItemId: STOCK_ITEM_ID,
        data: {
          movement_type: 'out',
          quantity_change: 999,
          reason: 'overdraft',
          performed_by: STAFF_ID,
        },
        tenantId: TENANT,
      }),
    ).rejects.toThrow('Insufficient stock for this adjustment');
  });

  it('passes through unfamiliar RPC errors verbatim', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = buildClient({
      rpc: [{ data: null, error: { code: 'XX000', message: 'something exploded' } }],
    });

    await expect(
      adjustStock(client, {
        stockItemId: STOCK_ITEM_ID,
        data: {
          movement_type: 'in',
          quantity_change: 5,
          reason: 'restock',
          performed_by: STAFF_ID,
        },
        tenantId: TENANT,
      }),
    ).rejects.toThrow('something exploded');

    warnSpy.mockRestore();
  });
});
