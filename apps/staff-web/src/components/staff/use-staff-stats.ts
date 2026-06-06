'use client';

import type { OrderWithDetails, StaffSchedule } from '@gustri/database/types';
import { useMemo } from 'react';

export interface StaffStats {
  ordersHandled: number;
  revenue: number;
  itemsSold: number;
  completionRate: number;
}

export function calculateHoursWorked(schedules: StaffSchedule[] | undefined) {
  if (!schedules) return 0;
  let total = 0;
  for (const sched of schedules) {
    if (sched.actual_start) {
      const start = new Date(sched.actual_start).getTime();
      const end = sched.actual_end
        ? new Date(sched.actual_end).getTime()
        : sched.status === 'in_progress'
          ? Date.now()
          : 0;
      if (end > start) {
        total += (end - start) / (1000 * 60 * 60);
      }
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * Computes performance stats and the recent-orders slice for a staff member.
 *
 * Revenue intentionally sums pre-tax item prices (`quantity * item_price`)
 * WITHOUT filtering cancelled items — this is the staff-detail page's own
 * metric and must not be swapped for `calculateOrderTotal` (different
 * tax/cancelled semantics).
 */
export function useStaffStats(allOrders: OrderWithDetails[] | undefined, staffId: string) {
  return useMemo(() => {
    if (!allOrders) return { stats: null as StaffStats | null, recentOrders: [] };

    const staffOrders = allOrders.filter((order) => order.assigned_waiter_id === staffId);

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let completedOrders = 0;

    for (const order of staffOrders) {
      const orderTotal =
        order.order_items?.reduce((sum, item) => sum + item.quantity * item.item_price, 0) || 0;

      const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      totalRevenue += orderTotal;
      totalItemsSold += itemCount;
      if (order.status === 'closed') completedOrders++;
    }

    const completionRate =
      staffOrders.length > 0 ? Math.round((completedOrders / staffOrders.length) * 100) : 0;

    return {
      stats: {
        ordersHandled: staffOrders.length,
        revenue: totalRevenue,
        itemsSold: totalItemsSold,
        completionRate,
      } as StaffStats,
      recentOrders: staffOrders.slice(0, 10),
    };
  }, [allOrders, staffId]);
}
