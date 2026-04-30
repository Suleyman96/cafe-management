/**
 * Query invalidation helpers
 * Groups related query invalidations to reduce boilerplate in hooks.
 */

import type { Order } from '@gustri/database';
import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './keys';

/**
 * Transition info for {@link invalidateOrdersAndTables}. Pass whatever the
 * caller knows. When *all* fields are undefined we fall back to the
 * pre-M6 behavior (invalidate every order list and tables) so call sites
 * that genuinely don't have the info — bulk cleanups, etc. — stay safe.
 *
 * When fields ARE provided, the helper scopes the invalidation:
 * - TABLES: only when the transition crosses a terminal state
 *   ({@link TERMINAL_ORDER_STATUSES}).
 * - DELIVERY_ORDERS: only when status touches the delivery flow or
 *   type === 'delivery'.
 * - TAKEOUT_ORDERS: only when type === 'takeout'.
 */
export interface OrderTransition {
  oldStatus?: Order['status'];
  newStatus?: Order['status'];
  oldType?: Order['order_type'];
  newType?: Order['order_type'];
  orderId?: string;
}

const TERMINAL_ORDER_STATUSES: ReadonlySet<Order['status']> = new Set([
  'closed',
  'cancelled',
] as const);
const DELIVERY_FLOW_STATUSES: ReadonlySet<Order['status']> = new Set([
  'out_for_delivery',
  'delivered',
] as const);

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

/**
 * Invalidate orders + (selectively) tables based on the actual status/type
 * transition. Pre-M6 the helper invalidated TABLES + DELIVERY + TAKEOUT
 * unconditionally — toggling 10 item statuses on the kitchen view fired 10
 * unnecessary table refetches. Now:
 *
 * - ORDERS / ACTIVE_ORDERS: always invalidated.
 * - TABLES: only when the transition crosses a terminal state
 *   (closed/cancelled), i.e. a state that frees the table.
 * - DELIVERY_ORDERS: only when status involves the delivery flow or the
 *   order type is delivery.
 * - TAKEOUT_ORDERS: only when the order type is takeout.
 *
 * If `transition` is empty (no fields), behavior falls back to the pre-M6
 * superset so callers without transition info (bulk cleanups, etc.) stay
 * conservative.
 */
export function invalidateOrdersAndTables(qc: QueryClient, transition: OrderTransition = {}) {
  const { oldStatus, newStatus, oldType, newType, orderId } = transition;
  const allUnknown =
    oldStatus === undefined &&
    newStatus === undefined &&
    oldType === undefined &&
    newType === undefined;

  if (orderId) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, orderId] });
  }
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.ACTIVE_ORDERS] });

  // TABLES: invalidate when the order entered or left a terminal state.
  // Crossing closed↔!closed (or cancelled↔!cancelled) frees or claims a table.
  const wasTerminal = oldStatus !== undefined && TERMINAL_ORDER_STATUSES.has(oldStatus);
  const isTerminal = newStatus !== undefined && TERMINAL_ORDER_STATUSES.has(newStatus);
  const tablesNeeded = allUnknown || wasTerminal !== isTerminal;
  if (tablesNeeded) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
  }

  // DELIVERY_ORDERS: status touches the delivery flow OR type involves delivery.
  const statusTouchesDelivery =
    (newStatus !== undefined &&
      (DELIVERY_FLOW_STATUSES.has(newStatus) || TERMINAL_ORDER_STATUSES.has(newStatus))) ||
    (oldStatus !== undefined && DELIVERY_FLOW_STATUSES.has(oldStatus));
  const typeIsDelivery = oldType === 'delivery' || newType === 'delivery';
  if (allUnknown || statusTouchesDelivery || typeIsDelivery) {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.DELIVERY_ORDERS] });
  }

  // TAKEOUT_ORDERS: only when the order type is takeout.
  if (allUnknown || oldType === 'takeout' || newType === 'takeout') {
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.TAKEOUT_ORDERS] });
  }
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
