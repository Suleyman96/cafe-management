import { rpc } from './rpc-typed';
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

// Plan 14 — end-of-shift reconciliation. Mirrors the JSONB shape returned by
// the get_shift_reconciliation RPC. The DB function aggregates closed orders
// + payments + refunds + comps in a single roundtrip; this typing pins down
// what the page consumes so the JSON-from-RPC -> typed-prop transition stays
// honest at compile time.
export interface ShiftReconciliationSummary {
  order_count: number;
  expected_revenue: number;
  payments_received: number;
  tips_collected: number;
  refunds_total: number;
  refund_count: number;
  comps_total: number;
  comp_count: number;
}

export interface ShiftReconciliationByMethod {
  payment_method: string;
  amount: number;
  tips: number;
  payment_count: number;
}

export interface ShiftReconciliationPerStaff {
  staff_id: string;
  staff_name: string;
  staff_role: string;
  orders_handled: number;
  revenue: number;
  payment_count: number;
  payments_collected: number;
  refunds_processed: number;
}

export interface ShiftReconciliationCompRow {
  reason: string;
  comp_count: number;
  amount: number;
}

export interface ShiftReconciliation {
  summary: ShiftReconciliationSummary;
  by_method: ShiftReconciliationByMethod[];
  per_staff: ShiftReconciliationPerStaff[];
  comps: ShiftReconciliationCompRow[];
  range: { from: string; to: string };
}

export function createReportsWrapper(ctx: WrapperContext) {
  return {
    getRevenueSummary: async (from: string, to: string) => {
      const data = await rpc(ctx, 'get_revenue_summary', { p_from: from, p_to: to });
      return (data || []) as unknown as RevenueSummaryRow[];
    },

    getTopSoldItems: async (from: string, to: string, limit?: number) => {
      const data = await rpc(ctx, 'get_top_sold_items', {
        p_from: from,
        p_to: to,
        p_limit: limit ?? 20,
      });
      return (data || []) as unknown as TopSoldItemRow[];
    },

    getExpenseSummary: async (from: string, to: string) => {
      const data = await rpc(ctx, 'get_expense_summary', { p_from: from, p_to: to });
      return (data || []) as unknown as ExpenseSummaryRow[];
    },

    getWasteSummary: async (from: string, to: string) => {
      const data = await rpc(ctx, 'get_waste_summary', { p_from: from, p_to: to });
      return (data || []) as unknown as WasteSummaryRow[];
    },

    getStaffPerformance: async (from: string, to: string) => {
      const data = await rpc(ctx, 'get_staff_performance', { p_from: from, p_to: to });
      return (data || []) as unknown as StaffPerformanceRow[];
    },

    getShiftReconciliation: async (from: string, to: string): Promise<ShiftReconciliation> => {
      const data = await rpc(ctx, 'get_shift_reconciliation', { p_from: from, p_to: to });
      // The RPC always returns an object shaped like ShiftReconciliation;
      // empty ranges return zeroed counters, not null. We still guard
      // because RPC return types come back as `Json` which permits null.
      if (!data || typeof data !== 'object') {
        return {
          summary: {
            order_count: 0,
            expected_revenue: 0,
            payments_received: 0,
            tips_collected: 0,
            refunds_total: 0,
            refund_count: 0,
            comps_total: 0,
            comp_count: 0,
          },
          by_method: [],
          per_staff: [],
          comps: [],
          range: { from, to },
        };
      }
      return data as unknown as ShiftReconciliation;
    },
  };
}

export type ReportsWrapper = ReturnType<typeof createReportsWrapper>;
