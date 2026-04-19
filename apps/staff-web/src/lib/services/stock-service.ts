import type { SupabaseClient } from '@supabase/supabase-js';

interface AdjustStockParams {
  stockItemId: string;
  data: {
    movement_type: 'in' | 'out' | 'adjustment';
    quantity_change: number;
    reason: string;
    performed_by: string;
  };
  tenantId: string;
}

export async function adjustStock(supabaseAdmin: SupabaseClient, params: AdjustStockParams) {
  const { stockItemId, data, tenantId } = params;

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
  });

  if (movementError) {
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

  return updated;
}
