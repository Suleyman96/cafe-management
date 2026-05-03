/**
 * Query invalidation helpers
 * Groups related query invalidations to reduce boilerplate in hooks.
 *
 * Every helper takes a `tenantId` so invalidations only touch the current
 * tenant's cache slot. Passing `null` invalidates the no-tenant scope —
 * never default this argument; callers must thread the value in explicitly
 * or we re-introduce the cross-tenant cache bleed the audit flagged.
 */

import type { Order } from '@gustri/database';
import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from './keys';

type TenantId = string | null | undefined;

/**
 * Transition info for {@link invalidateOrdersAndTables}. Pass whatever the
 * caller knows. When *all* fields are undefined we fall back to the
 * pre-M6 behavior (invalidate every order list and tables) so call sites
 * that genuinely don't have the info — bulk cleanups, etc. — stay safe.
 *
 * When fields ARE provided, the helper scopes the invalidation:
 * - TABLES: when the transition crosses a terminal state
 *   ({@link TERMINAL_ORDER_STATUSES}), or when `isCreation` is true and
 *   the new type is `dine_in` (a freshly-created dine-in order claims a table).
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
  /** True when the transition is a freshly-created order (no prior state). */
  isCreation?: boolean;
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
export function invalidateOrders(qc: QueryClient, tenantId: TenantId, orderId?: string) {
  if (orderId) {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, orderId) });
  }
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS) });
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
export function invalidateOrdersAndTables(
  qc: QueryClient,
  tenantId: TenantId,
  transition: OrderTransition = {},
) {
  const { oldStatus, newStatus, oldType, newType, orderId, isCreation } = transition;
  const allUnknown =
    oldStatus === undefined &&
    newStatus === undefined &&
    oldType === undefined &&
    newType === undefined &&
    !isCreation;

  if (orderId) {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, orderId) });
  }
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });

  // TABLES: invalidate when the order entered or left a terminal state, or
  // when a fresh dine-in order is created (claims a table). Crossing
  // closed↔!closed (or cancelled↔!cancelled) frees or claims a table.
  const wasTerminal = oldStatus !== undefined && TERMINAL_ORDER_STATUSES.has(oldStatus);
  const isTerminal = newStatus !== undefined && TERMINAL_ORDER_STATUSES.has(newStatus);
  // On creation the type defaults to dine_in if unknown — the conservative
  // assumption is that an unidentified new order may claim a table.
  const isCreatingDineIn = isCreation === true && newType !== 'takeout' && newType !== 'delivery';
  const tablesNeeded = allUnknown || wasTerminal !== isTerminal || isCreatingDineIn;
  if (tablesNeeded) {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
  }

  // DELIVERY_ORDERS: status touches the delivery flow OR type involves delivery.
  const statusTouchesDelivery =
    (newStatus !== undefined &&
      (DELIVERY_FLOW_STATUSES.has(newStatus) || TERMINAL_ORDER_STATUSES.has(newStatus))) ||
    (oldStatus !== undefined && DELIVERY_FLOW_STATUSES.has(oldStatus));
  const typeIsDelivery = oldType === 'delivery' || newType === 'delivery';
  if (allUnknown || statusTouchesDelivery || typeIsDelivery) {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS) });
  }

  // TAKEOUT_ORDERS: only when the order type is takeout.
  if (allUnknown || oldType === 'takeout' || newType === 'takeout') {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS) });
  }
}

// ─── Delivery ───────────────────────────────────────────────────────────────

export function invalidateDeliveryOrders(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });
}

// ─── Takeout ────────────────────────────────────────────────────────────────

export function invalidateTakeoutOrders(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });
}

// ─── Stock ──────────────────────────────────────────────────────────────────

export function invalidateStock(qc: QueryClient, tenantId: TenantId, includeMovements = false) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_ITEMS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.LOW_STOCK_COUNT) });
  if (includeMovements) {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_MOVEMENTS) });
  }
}

export function refetchStock(qc: QueryClient, tenantId: TenantId, includeMovements = false) {
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_ITEMS) });
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.LOW_STOCK_COUNT) });
  if (includeMovements) {
    qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_MOVEMENTS) });
  }
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export function invalidateExpenses(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSES) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE_CATEGORIES) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY) });
}

export function refetchExpenses(qc: QueryClient, tenantId: TenantId) {
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSES) });
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY) });
}

// ─── Waste ──────────────────────────────────────────────────────────────────

export function invalidateWaste(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WASTE_LOGS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WASTE_SUMMARY) });
}

export function refetchWaste(qc: QueryClient, tenantId: TenantId) {
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WASTE_LOGS) });
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WASTE_SUMMARY) });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export function invalidateTasks(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TASKS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.OVERDUE_TASKS_COUNT) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.OPEN_TASKS_COUNT) });
}

export function refetchTasks(qc: QueryClient, tenantId: TenantId) {
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TASKS) });
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.OVERDUE_TASKS_COUNT) });
  qc.refetchQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.OPEN_TASKS_COUNT) });
}

// ─── Schedules ──────────────────────────────────────────────────────────────

export function invalidateSchedules(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.SCHEDULES) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MY_SCHEDULE) });
}

// ─── Waiter Calls ───────────────────────────────────────────────────────────

export function invalidateWaiterCalls(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS_COUNT) });
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export function invalidateMenuAndCategories(qc: QueryClient, tenantId: TenantId) {
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.CATEGORIES) });
  qc.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
}
