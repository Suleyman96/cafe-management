/**
 * Stock items wrapper module
 */

import { isStockItem } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { StockItemInsert, StockItemRow, StockItemUpdate, WrapperContext } from './types';

export function createStockItemsWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { category?: string; lowStockOnly?: boolean; limit?: number }) => {
      const limit = options?.limit ?? 1000;
      let query = applyTenantScope(
        ctx.client.from('stock_items').select('*').eq('is_active', true).order('name').limit(limit),
        ctx,
      );

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
      const { data, error } = await applyTenantScope(
        ctx.client.from('stock_items').select('*').eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isStockItem(data)) throw new Error('Invalid stock item data');
      return data as StockItemRow;
    },

    create: async (data: StockItemInsert) => {
      assertInsertTenantMatches(data, ctx);
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
      _id: string,
      _data: {
        type: 'in' | 'out' | 'adjustment';
        quantity: number;
        reason?: string;
        performedBy?: string;
      },
    ): Promise<StockItemRow> => {
      // Stock adjustments must go through the server route
      // /api/v1/stock/[id]/adjust which computes quantity_after server-side
      // and writes via service_role. Direct client writes to stock_movements
      // were removed by migration 20260428000001 (security hardening) so the
      // ledger and on-hand count cannot drift through forged quantity_after.
      throw new Error(
        'db.stockItems.adjustStock is disabled. Use apiRoutes.stock.adjust(id, ...) instead.',
      );
    },

    getMovements: async (stockItemId: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('stock_movements')
          .select(`
            *,
            performed_by_staff:staff!stock_movements_performed_by_fkey(full_name)
          `)
          .eq('stock_item_id', stockItemId)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getLowStockCount: async () => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('stock_items')
          .select('id, quantity, minimum_stock_level')
          .eq('is_active', true),
        ctx,
      );

      if (error) throw handleSupabaseError(error);

      return (data || []).filter(
        (item: Pick<StockItemRow, 'quantity' | 'minimum_stock_level'>) =>
          item.quantity <= item.minimum_stock_level,
      ).length;
    },

    getTotalValue: async () => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('stock_items').select('quantity, cost_price').eq('is_active', true),
        ctx,
      );

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
