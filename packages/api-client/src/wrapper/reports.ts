import { handleSupabaseError } from '@gustri/core';
import type { WrapperContext } from './types';

export interface RevenueSummaryRow {
  report_date: string;
  total_revenue: number;
  order_count: number;
  avg_ticket: number;
  completed_count: number;
  cancelled_count: number;
  dine_in_count: number;
  takeout_count: number;
  delivery_count: number;
  total_items: number;
  total_discounts: number;
}

export interface TopSoldItemRow {
  menu_item_id: string;
  item_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface ExpenseSummaryRow {
  category_name: string;
  total_amount: number;
  entry_count: number;
}

export interface WasteSummaryRow {
  waste_reason: string;
  item_name: string;
  total_quantity: number;
  total_cost: number;
  entry_count: number;
}

export interface StaffPerformanceRow {
  staff_id: string;
  staff_name: string;
  staff_role: string;
  orders_handled: number;
  revenue: number;
  items_sold: number;
  completed_orders: number;
  cancelled_orders: number;
}

export function createReportsWrapper(ctx: WrapperContext) {
  return {
    getRevenueSummary: async (tenantId: string, from: string, to: string) => {
      const { data, error } = await ctx.anyClient.rpc('get_revenue_summary', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []) as RevenueSummaryRow[];
    },

    getTopSoldItems: async (tenantId: string, from: string, to: string, limit?: number) => {
      const { data, error } = await ctx.anyClient.rpc('get_top_sold_items', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
        p_limit: limit ?? 20,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []) as TopSoldItemRow[];
    },

    getExpenseSummary: async (tenantId: string, from: string, to: string) => {
      const { data, error } = await ctx.anyClient.rpc('get_expense_summary', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []) as ExpenseSummaryRow[];
    },

    getWasteSummary: async (tenantId: string, from: string, to: string) => {
      const { data, error } = await ctx.anyClient.rpc('get_waste_summary', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []) as WasteSummaryRow[];
    },

    getStaffPerformance: async (tenantId: string, from: string, to: string) => {
      const { data, error } = await ctx.anyClient.rpc('get_staff_performance', {
        p_tenant_id: tenantId,
        p_from: from,
        p_to: to,
      });

      if (error) throw handleSupabaseError(error);
      return (data || []) as StaffPerformanceRow[];
    },
  };
}

export type ReportsWrapper = ReturnType<typeof createReportsWrapper>;
