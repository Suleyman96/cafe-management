import type { OrderItemWithMenuItem, OrderWithDetails } from '@/types';

export interface ReportTotals {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  completionRate: number;
}

export interface OrderTypeBreakdown {
  dine_in: number;
  takeout: number;
  delivery: number;
}

export interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

export interface StaffPerf {
  name: string;
  orders: number;
  revenue: number;
}

export interface AggregateResult {
  totals: ReportTotals;
  byType: OrderTypeBreakdown;
  topItems: TopItem[];
  byStaff: StaffPerf[];
}

interface StaffLookup {
  id: string;
  full_name?: string | null;
}

const TOP_LIMIT = 10;

/**
 * One-pass aggregation over the filtered orders + staff list.
 *
 * Pre-M13 the screen ran four separate `useMemo` blocks over the same array,
 * with a nested `staffList.find()` per row inside the staff-performance
 * memo (O(orders × staff)). This builds a `Map<staffId, …>` for O(1) lookups
 * and walks `filteredOrders` exactly once.
 *
 * `unknownLabel` lets the caller inject the localized fallback for missing
 * names — keeps this helper headless / i18n-agnostic.
 */
export function aggregateReports(
  orders: ReadonlyArray<OrderWithDetails>,
  staffList: ReadonlyArray<StaffLookup> | null | undefined,
  unknownLabel: string,
): AggregateResult {
  const staffMap = new Map<string, StaffLookup>();
  for (const s of staffList ?? []) staffMap.set(s.id, s);

  let revenue = 0;
  let paidCount = 0;
  const byType: OrderTypeBreakdown = { dine_in: 0, takeout: 0, delivery: 0 };
  const itemAgg = new Map<string, TopItem>();
  const staffAgg = new Map<string, StaffPerf>();

  for (const o of orders) {
    const isPaid = o.status === 'closed' || o.status === 'served';
    if (isPaid) {
      paidCount++;
      revenue += o.total || 0;
    }

    const ot = (o.order_type || 'dine_in') as keyof OrderTypeBreakdown;
    if (ot in byType) byType[ot]++;

    for (const item of (o.order_items || []) as OrderItemWithMenuItem[]) {
      const name = item.menu_item?.name || unknownLabel;
      const existing = itemAgg.get(name) ?? { name, qty: 0, revenue: 0 };
      existing.qty += item.quantity || 0;
      existing.revenue += (item.item_price || 0) * (item.quantity || 0);
      itemAgg.set(name, existing);
    }

    const wId = o.assigned_waiter_id;
    if (wId) {
      const existing = staffAgg.get(wId);
      if (existing) {
        existing.orders++;
        existing.revenue += o.total || 0;
      } else {
        const s = staffMap.get(wId);
        staffAgg.set(wId, {
          name: s?.full_name || unknownLabel,
          orders: 1,
          revenue: o.total || 0,
        });
      }
    }
  }

  const orderCount = orders.length;
  const totals: ReportTotals = {
    revenue,
    orderCount,
    avgOrderValue: paidCount > 0 ? revenue / paidCount : 0,
    completionRate: orderCount > 0 ? (paidCount / orderCount) * 100 : 0,
  };

  const topItems = [...itemAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, TOP_LIMIT);
  const byStaff = [...staffAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, TOP_LIMIT);

  return { totals, byType, topItems, byStaff };
}
