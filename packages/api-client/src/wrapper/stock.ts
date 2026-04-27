/**
 * Stock items wrapper module
 */

import { handleSupabaseError, isStockItem } from '@gustri/core';
import type { StockItemInsert, StockItemRow, StockItemUpdate, WrapperContext } from './types';

export function createStockItemsWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { category?: string; lowStockOnly?: boolean; limit?: number }) => {
      const limit = options?.limit ?? 1000;
      let query = ctx.client
        .from('stock_items')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .limit(limit);

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);

      const items = data || [];

      if (options?.lowStockOnly) {
        return items.filter((item: StockItemRow) => item.quantity <= item.minimum_stock_level);
      }

      return items;
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('stock_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStockItem(data)) throw new Error('Invalid stock item data');
      return data as StockItemRow;
    },

    create: async (data: StockItemInsert) => {
      const { data: result, error } = await ctx.anyClient
        .from('stock_items')
        .insert(data)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStockItem(result)) throw new Error('Invalid stock item data');
      return result as StockItemRow;
    },

    update: async (id: string, updates: Partial<StockItemUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('stock_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStockItem(data)) throw new Error('Invalid stock item data');
      return data as StockItemRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient
        .from('stock_items')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    adjustStock: async (
      id: string,
      data: {
        type: 'in' | 'out' | 'adjustment';
        quantity: number;
        reason?: string;
        performedBy?: string;
      },
    ) => {
      // Get current stock item
      const { data: item, error: fetchError } = await ctx.client
        .from('stock_items')
        .select('quantity')
        .eq('id', id)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);

      const currentQuantity = (item as StockItemRow).quantity;
      let newQuantity: number;

      if (data.type === 'in') {
        newQuantity = currentQuantity + data.quantity;
      } else if (data.type === 'out') {
        newQuantity = currentQuantity - data.quantity;
      } else {
        newQuantity = data.quantity;
      }

      // Insert movement record
      const { error: movementError } = await ctx.anyClient.from('stock_movements').insert({
        stock_item_id: id,
        movement_type: data.type,
        quantity_change: data.type === 'out' ? -data.quantity : data.quantity,
        quantity_after: newQuantity,
        reason: data.reason || null,
        performed_by: data.performedBy || null,
      });

      if (movementError) throw handleSupabaseError(movementError);

      // Update stock quantity
      const { data: updated, error: updateError } = await ctx.anyClient
        .from('stock_items')
        .update({ quantity: newQuantity })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw handleSupabaseError(updateError);
      return updated as StockItemRow;
    },

    getMovements: async (stockItemId: string) => {
      const { data, error } = await ctx.client
        .from('stock_movements')
        .select(`
          *,
          performed_by_staff:staff!stock_movements_performed_by_fkey(full_name)
        `)
        .eq('stock_item_id', stockItemId)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getLowStockCount: async () => {
      const { data, error } = await ctx.client
        .from('stock_items')
        .select('id, quantity, minimum_stock_level')
        .eq('is_active', true);

      if (error) throw handleSupabaseError(error);

      return (data || []).filter(
        (item: Pick<StockItemRow, 'quantity' | 'minimum_stock_level'>) =>
          item.quantity <= item.minimum_stock_level,
      ).length;
    },

    getTotalValue: async () => {
      const { data, error } = await ctx.client
        .from('stock_items')
        .select('quantity, cost_price')
        .eq('is_active', true);

      if (error) throw handleSupabaseError(error);

      return (data || []).reduce(
        (total: number, item: Pick<StockItemRow, 'quantity' | 'cost_price'>) =>
          total + item.quantity * item.cost_price,
        0,
      );
    },
  };
}

export type StockItemsWrapper = ReturnType<typeof createStockItemsWrapper>;
