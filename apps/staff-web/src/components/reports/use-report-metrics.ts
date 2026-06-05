'use client';

import { useMemo } from 'react';
import {
  useExpenseSummary,
  useRevenueSummary,
  useStaffPerformance,
  useTopSoldItems,
  useWasteSummary,
  useZReport,
} from '@/hooks';

interface ReportDateInputs {
  tenantId: string | undefined;
  dateStrings: { from: string; to: string };
  expenseDateRange: { startDate: string; endDate: string };
}

/**
 * Fetches the server-aggregated report rows for the selected range and derives
 * the view-model the reports page renders (revenue/profit/waste/staff/Z-report
 * metrics + combined loading flag). Extracted verbatim from ReportsPage.
 */
export function useReportMetrics({ tenantId, dateStrings, expenseDateRange }: ReportDateInputs) {
  // Server-side aggregated data
  const { data: revenueRows, isLoading: revenueLoading } = useRevenueSummary(
    tenantId,
    dateStrings.from,
    dateStrings.to,
  );
  const { data: topSoldItems, isLoading: itemsLoading } = useTopSoldItems(
    tenantId,
    dateStrings.from,
    dateStrings.to,
  );
  const { data: expenseSummary, isLoading: expensesLoading } = useExpenseSummary(
    tenantId,
    expenseDateRange.startDate,
    expenseDateRange.endDate,
  );
  const { data: wasteSummaryRows, isLoading: wasteLoading } = useWasteSummary(
    tenantId,
    expenseDateRange.startDate,
    expenseDateRange.endDate,
  );
  const { data: staffPerformanceRows, isLoading: staffLoading } = useStaffPerformance(
    tenantId,
    dateStrings.from,
    dateStrings.to,
  );
  const { data: zReportPaymentsRaw, isLoading: zReportLoading } = useZReport(
    `${expenseDateRange.startDate}T00:00:00`,
    `${expenseDateRange.endDate}T00:00:00`,
  );
  const zReportPayments = (zReportPaymentsRaw || []) as Array<{
    amount: number;
    tip_amount: number;
    payment_method: string;
  }>;

  // Aggregate revenue rows (summing across days)
  const metrics = useMemo(() => {
    const rows = revenueRows || [];
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.total_revenue), 0);
    const totalOrders = rows.reduce((sum, r) => sum + r.order_count, 0);
    const completedOrders = rows.reduce((sum, r) => sum + r.completed_count, 0);
    const cancelledOrders = rows.reduce((sum, r) => sum + r.cancelled_count, 0);
    const dineInOrders = rows.reduce((sum, r) => sum + r.dine_in_count, 0);
    const takeoutOrders = rows.reduce((sum, r) => sum + r.takeout_count, 0);
    const deliveryOrders = rows.reduce((sum, r) => sum + r.delivery_count, 0);
    const totalItems = rows.reduce((sum, r) => sum + r.total_items, 0);
    const totalDiscounts = rows.reduce((sum, r) => sum + Number(r.total_discounts), 0);

    const soldItems = (topSoldItems || []).map((item) => ({
      name: item.item_name,
      count: item.total_quantity,
      revenue: Number(item.total_revenue),
    }));

    return {
      totalRevenue,
      totalOrders,
      completedOrders,
      cancelledOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      dineInOrders,
      takeoutOrders,
      deliveryOrders,
      totalItems,
      soldItems,
      totalDiscounts,
    };
  }, [revenueRows, topSoldItems]);

  // Build profit metrics from expense summary
  const profitMetrics = useMemo(() => {
    const cats = (expenseSummary || []).map((e) => ({
      name: e.category_name,
      count: e.entry_count,
      total: Number(e.total_amount),
    }));
    const totalExpenses = cats.reduce((sum, c) => sum + c.total, 0);
    const netProfit = metrics.totalRevenue - totalExpenses;
    const profitMargin = metrics.totalRevenue > 0 ? (netProfit / metrics.totalRevenue) * 100 : 0;

    return { totalExpenses, netProfit, profitMargin, byCategory: cats };
  }, [expenseSummary, metrics.totalRevenue]);

  // Build waste metrics from waste summary
  const wasteMetrics = useMemo(() => {
    const rows = wasteSummaryRows || [];
    const totalCost = rows.reduce((sum, r) => sum + Number(r.total_cost), 0);
    const totalItems = rows.reduce((sum, r) => sum + r.entry_count, 0);

    const reasonMap = new Map<string, { count: number; cost: number }>();
    rows.forEach((r) => {
      const current = reasonMap.get(r.waste_reason) || { count: 0, cost: 0 };
      reasonMap.set(r.waste_reason, {
        count: current.count + r.entry_count,
        cost: current.cost + Number(r.total_cost),
      });
    });
    const byReason = Array.from(reasonMap.entries())
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.cost - a.cost);

    const itemMap = new Map<
      string,
      { name: string; quantity: number; unit: string; cost: number }
    >();
    rows.forEach((r) => {
      const current = itemMap.get(r.item_name) || {
        name: r.item_name,
        quantity: 0,
        unit: 'pieces',
        cost: 0,
      };
      itemMap.set(r.item_name, {
        ...current,
        quantity: current.quantity + Number(r.total_quantity),
        cost: current.cost + Number(r.total_cost),
      });
    });
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return { totalCost, totalItems, byReason, topItems };
  }, [wasteSummaryRows]);

  // Map staff performance rows to the shape expected by StaffPerformanceSection
  const staffPerformance = useMemo(
    () =>
      (staffPerformanceRows || []).map((r) => ({
        id: r.staff_id,
        name: r.staff_name,
        role: r.staff_role,
        ordersHandled: r.orders_handled,
        revenue: Number(r.revenue),
        itemsSold: r.items_sold,
        completedOrders: r.completed_orders,
        cancelledOrders: r.cancelled_orders,
      })),
    [staffPerformanceRows],
  );

  // Calculate Z-Report metrics from payments
  const zReportData = useMemo(() => {
    const data = {
      cashTotal: 0,
      cardTotal: 0,
      digitalTotal: 0,
      tipsCollected: 0,
      paymentCount: zReportPayments.length,
      totalDiscounts: metrics.totalDiscounts,
    };
    for (const p of zReportPayments) {
      const amount = p.amount || 0;
      const tip = p.tip_amount || 0;
      if (p.payment_method === 'cash') data.cashTotal += amount;
      else if (p.payment_method === 'card') data.cardTotal += amount;
      else if (p.payment_method === 'digital') data.digitalTotal += amount;
      data.tipsCollected += tip;
    }
    return data;
  }, [zReportPayments, metrics.totalDiscounts]);

  const loading =
    revenueLoading ||
    itemsLoading ||
    expensesLoading ||
    wasteLoading ||
    staffLoading ||
    zReportLoading;

  return { metrics, profitMetrics, wasteMetrics, staffPerformance, zReportData, loading };
}
