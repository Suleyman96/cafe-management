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

/**
 * Adjust stock for a single item. Inserts a `stock_movements` ledger row
 * and updates the on-hand quantity on `stock_items`.
 *
 * Idempotent on `client_request_id`: when a replayed mutation arrives
 * after the original committed, we skip both the insert and the update.
 * Doing the update twice would over-decrement (out movements) or
 * over-increment (in movements). The ledger row is the dedupe anchor —
 * once it exists with this key, the side effects (quantity update) have
 * already been applied.
 */
export async function adjustStock(supabaseAdmin: SupabaseClient, params: AdjustStockParams) {
  const { stockItemId, data, tenantId } = params;
  const clientRequestId = data.client_request_id;

  if (clientRequestId) {
    const { data: existingMovement, error: lookupError } = await supabaseAdmin
      .from('stock_movements')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);

    if (existingMovement) {
      // The first attempt already adjusted the on-hand count. Return the
      // current stock item so the client sees the post-adjustment state.
      const { data: item, error: itemError } = await supabaseAdmin
        .from('stock_items')
        .select()
        .eq('id', stockItemId)
        .eq('tenant_id', tenantId)
        .single();
      if (itemError) throw new Error(itemError.message);
      return { stockItem: item, deduped: true };
    }
  }

  // Verify stock item belongs to this tenant
  const { data: item, error: fetchError } = await supabaseAdmin
    .from('stock_items')
    .select('id, quantity, tenant_id')
    .eq('id', stockItemId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (fetchError || !item) {
    throw new Error('Stock item not found');
  }

  const currentQuantity = Number(item.quantity);
  let newQuantity: number;

  if (data.movement_type === 'in') {
    newQuantity = currentQuantity + data.quantity_change;
  } else if (data.movement_type === 'out') {
    newQuantity = currentQuantity - data.quantity_change;
    if (newQuantity < 0) {
      throw new Error('Insufficient stock for this adjustment');
    }
  } else {
    // adjustment — set to absolute value
    newQuantity = data.quantity_change;
  }

  // Insert movement record
  const { error: movementError } = await supabaseAdmin.from('stock_movements').insert({
    stock_item_id: stockItemId,
    movement_type: data.movement_type,
    quantity_change: data.movement_type === 'out' ? -data.quantity_change : data.quantity_change,
    quantity_after: newQuantity,
    reason: data.reason,
    performed_by: data.performed_by,
    tenant_id: tenantId,
    client_request_id: clientRequestId ?? null,
  });

  if (movementError) {
    // Race: a concurrent replay inserted the movement between our lookup
    // and our insert. The on-hand count was updated by that other request,
    // so don't re-update — just return the current stock item.
    if (isUniqueViolation(movementError) && clientRequestId) {
      const { data: refetched, error: refetchError } = await supabaseAdmin
        .from('stock_items')
        .select()
        .eq('id', stockItemId)
        .eq('tenant_id', tenantId)
        .single();
      if (refetchError) throw new Error(refetchError.message);
      return { stockItem: refetched, deduped: true };
    }
    throw new Error(movementError.message);
  }

  // Update stock quantity
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('stock_items')
    .update({ quantity: newQuantity })
    .eq('id', stockItemId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { stockItem: updated, deduped: false };
}
