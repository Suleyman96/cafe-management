/**
 * Waste logs wrapper module
 */

import { handleSupabaseError, isWasteLog } from '@gustri/core';
import type { WasteLogInsert, WasteLogRow, WasteLogUpdate, WrapperContext } from './types';

export function createWasteWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: {
      startDate?: string;
      endDate?: string;
      reason?: string;
      stockItemId?: string;
      limit?: number;
      offset?: number;
    }) => {
      let query = ctx.client
        .from('waste_logs')
        .select(`
          *,
          logged_by_staff:staff!waste_logs_logged_by_fkey(full_name),
          stock_item:stock_items!waste_logs_stock_item_id_fkey(name, unit)
        `)
        .order('waste_date', { ascending: false });

      if (options?.startDate) {
        query = query.gte('waste_date', options.startDate);
      }
      if (options?.endDate) {
        query = query.lt('waste_date', options.endDate);
      }
      if (options?.reason) {
        query = query.eq('reason', options.reason);
      }
      if (options?.stockItemId) {
        query = query.eq('stock_item_id', options.stockItemId);
      }

      // Apply pagination with sensible defaults
      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('waste_logs')
        .select(`
          *,
          logged_by_staff:staff!waste_logs_logged_by_fkey(full_name),
          stock_item:stock_items!waste_logs_stock_item_id_fkey(name, unit)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWasteLog(data)) throw new Error('Invalid waste log data');
      return data as WasteLogRow;
    },

    create: async (data: WasteLogInsert) => {
      const { data: result, error } = await ctx.anyClient
        .from('waste_logs')
        .insert(data)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWasteLog(result)) throw new Error('Invalid waste log data');
      return result as WasteLogRow;
    },

    update: async (id: string, updates: Partial<WasteLogUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('waste_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWasteLog(data)) throw new Error('Invalid waste log data');
      return data as WasteLogRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('waste_logs').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    getMonthlySummary: async (year: number, month: number) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate =
        month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const { data, error } = await ctx.client
        .from('waste_logs')
        .select('total_cost, reason, category')
        .gte('waste_date', startDate)
        .lt('waste_date', endDate);

      if (error) throw handleSupabaseError(error);

      type WasteSummaryProjection = Pick<WasteLogRow, 'total_cost' | 'reason' | 'category'>;
      const logs = (data || []) as WasteSummaryProjection[];
      const totalCost = logs.reduce((sum: number, l) => sum + (l.total_cost ?? 0), 0);
      const byReason: Record<string, { reason: string; total: number; count: number }> = {};
      const byCategory: Record<string, { category: string; total: number; count: number }> = {};

      for (const l of logs) {
        const reason = l.reason || 'other';
        if (!byReason[reason]) {
          byReason[reason] = { reason, total: 0, count: 0 };
        }
        byReason[reason].total += l.total_cost ?? 0;
        byReason[reason].count += 1;

        const cat = l.category || 'General';
        if (!byCategory[cat]) {
          byCategory[cat] = { category: cat, total: 0, count: 0 };
        }
        byCategory[cat].total += l.total_cost ?? 0;
        byCategory[cat].count += 1;
      }

      return {
        totalCost,
        count: logs.length,
        byReason: Object.values(byReason).sort((a, b) => b.total - a.total),
        byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      };
    },

    getDailySummary: async (date: string) => {
      const { data, error } = await ctx.client
        .from('waste_logs')
        .select('total_cost')
        .eq('waste_date', date);

      if (error) throw handleSupabaseError(error);

      const logs = (data || []) as Pick<WasteLogRow, 'total_cost'>[];
      return {
        totalCost: logs.reduce((sum: number, l) => sum + (l.total_cost ?? 0), 0),
        count: logs.length,
      };
    },

    getTopWastedItems: async (limit = 5) => {
      const { data, error } = await ctx.client
        .from('waste_logs')
        .select('item_name, total_cost, quantity, unit')
        .order('total_cost', { ascending: false })
        .limit(limit);

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type WasteWrapper = ReturnType<typeof createWasteWrapper>;
