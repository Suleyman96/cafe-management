import type { SupabaseClient } from '@supabase/supabase-js';

interface AdjustStockParams {
  stockItemId: string;
  data: {
    movement_type: 'in' | 'out' | 'adjustment';
    quantity_change: number;
    reason: string;
    performed_by: string;
    client_request_id?: string;
  };
  tenantId: string;
}

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === PG_UNIQUE_VIOLATION;
}

async function refetchStockItem(
  supabaseAdmin: SupabaseClient,
  stockItemId: string,
  tenantId: string,
) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from('stock_items')
    .select()
    .eq('id', stockItemId)
    .eq('tenant_id', tenantId)
    .single();
  if (itemError) throw new Error(itemError.message);
  return item;
}

/**
 * Adjust stock for a single item. Writes a `stock_movements` ledger row
 * and updates the on-hand quantity on `stock_items` atomically.
 *
 * Concurrency: the read-modify-write happens inside the
 * `adjust_stock_atomic` RPC (migration 20260504000003), which holds
 * `SELECT … FOR UPDATE` on the stock_items row. Two concurrent
 * adjustments serialize on the lock so neither can clobber the other's
 * on-hand update with a stale baseline. The pre-RPC implementation
 * computed `newQuantity` in JS from a snapshot read, which lost-updated
 * under READ COMMITTED.
 *
 * Idempotency: a fast-path lookup short-circuits on `client_request_id`
 * matches (avoids the RPC round-trip entirely for sequential retries).
 * If the lookup misses but the RPC's INSERT trips the
 * `(tenant_id, client_request_id)` unique index — the case where two
 * concurrent attempts both miss the lookup — we treat 23505 as a
 * successful dedupe and return the current stock item.
 *
 * Domain errors raised by the RPC (`Stock item not found`,
 * `Insufficient stock for this adjustment`, …) are mapped back to the
 * pre-RPC thrown-Error surface so the route + UI contract is unchanged.
 */
export async function adjustStock(supabaseAdmin: SupabaseClient, params: AdjustStockParams) {
  const { stockItemId, data, tenantId } = params;
  const clientRequestId = data.client_request_id;

  // Fast path: a prior attempt with this client_request_id already wrote a
  // movement. Skip the RPC and return the current stock item. The unique
  // index on stock_movements is the correctness backstop; this lookup is a
  // round-trip optimisation for the common (sequential retry) case.
  if (clientRequestId) {
    const { data: existingMovement, error: lookupError } = await supabaseAdmin
      .from('stock_movements')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);

    if (existingMovement) {
      const item = await refetchStockItem(supabaseAdmin, stockItemId, tenantId);
      return { stockItem: item, deduped: true };
    }
  }

  const { data: updatedItem, error: rpcError } = await supabaseAdmin.rpc('adjust_stock_atomic', {
    p_stock_item_id: stockItemId,
    p_tenant_id: tenantId,
    p_movement_type: data.movement_type,
    p_quantity_change: data.quantity_change,
    p_reason: data.reason,
    p_performed_by: data.performed_by,
    p_client_request_id: clientRequestId ?? null,
  });

  if (rpcError) {
    // Concurrent dedupe: the lookup above missed but a parallel attempt won
    // the race on the unique index. The on-hand count was already adjusted
    // by that other attempt, so don't retry — return the current row.
    if (isUniqueViolation(rpcError) && clientRequestId) {
      const refetched = await refetchStockItem(supabaseAdmin, stockItemId, tenantId);
      return { stockItem: refetched, deduped: true };
    }

    // Map RPC RAISE messages back to the pre-RPC error surface so callers
    // (route handlers, UI) keep matching on the same strings.
    const message = rpcError.message ?? 'Failed to adjust stock';
    if (
      message.includes('Stock item not found') ||
      message.includes('Stock item tenant mismatch')
    ) {
      throw new Error('Stock item not found');
    }
    if (message.includes('Insufficient stock')) {
      throw new Error('Insufficient stock for this adjustment');
    }
    throw new Error(message);
  }

  return { stockItem: updatedItem, deduped: false };
}
