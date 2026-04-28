/**
 * Query invalidation helpers
 * Groups related query invalidations to reduce boilerplate in hooks.
 */

import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './keys';

// ─── Orders ─────────────────────────────────────────────────────────────────

/** Invalidate order lists + active orders. Optionally invalidate a specific order. */
export function invalidateOrders(qc: QueryClient, orderId?: string) {
  if (orderId) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
  }
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TAKEOUT_ORDERS] });
}

/** Invalidate orders + tables (for status changes that affect table state). */
export function invalidateOrdersAndTables(qc: QueryClient, orderId?: string) {
  if (orderId) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
  }
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TAKEOUT_ORDERS] });
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export function invalidateDeliveryOrders(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
}

// ─── Takeout ────────────────────────────────────────────────────────────────

export function invalidateTakeoutOrders(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TAKEOUT_ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });
}

// ─── Stock ──────────────────────────────────────────────────────────────────

export function invalidateStock(qc: QueryClient, includeMovements = false) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
  if (includeMovements) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
  }
}

export function refetchStock(qc: QueryClient, includeMovements = false) {
  qc.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
  qc.refetchQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
  if (includeMovements) {
    qc.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
  }
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export function invalidateExpenses(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
}

export function refetchExpenses(qc: QueryClient) {
  qc.refetchQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
  qc.refetchQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
}

// ─── Waste ──────────────────────────────────────────────────────────────────

export function invalidateWaste(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
}

export function refetchWaste(qc: QueryClient) {
  qc.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
  qc.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export function invalidateTasks(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT] });
}

export function refetchTasks(qc: QueryClient) {
  qc.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
  qc.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
  qc.refetchQueries({ queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT] });
}

// ─── Schedules ──────────────────────────────────────────────────────────────

export function invalidateSchedules(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.MY_SCHEDULE] });
}

// ─── Waiter Calls ───────────────────────────────────────────────────────────

export function invalidateWaiterCalls(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS_COUNT] });
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export function invalidateMenuAndCategories(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
}
