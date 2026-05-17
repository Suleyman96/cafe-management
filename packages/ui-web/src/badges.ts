/**
 * Tailwind utility class helpers for status / role badges.
 *
 * Lives here (not in `@gustri/design-tokens`) because the return values
 * are Tailwind class strings — a UI concern. The headless `BadgeConfig`
 * type lives in `@gustri/design-tokens`; web populates the records with
 * Tailwind class strings (`bg-amber-100`), mobile populates the
 * matching records with hex values (`#fef3c7`).
 *
 * Each `*_BADGES` Record below is keyed by the corresponding enum, so
 * adding a new enum value (e.g. a new `OrderStatus` variant) fails
 * compile across every consumer that destructures from the map. That's
 * the whole point — never let a stray unknown status slip through to a
 * `default:` arm again.
 */

import type {
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  TableStatus,
  UserRole,
} from '@gustri/database';
import type { BadgeConfig } from '@gustri/design-tokens';

/**
 * Badge styling per `OrderStatus`. Keyed by enum so missing variants fail
 * `pnpm type-check`.
 */
export const ORDER_STATUS_BADGES: Record<OrderStatus, BadgeConfig> = {
  pending_approval: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    labelKey: 'orders.pendingApproval',
  },
  new: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    labelKey: 'orders.new',
  },
  preparing: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    labelKey: 'orders.preparing',
  },
  ready: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    labelKey: 'orders.ready',
  },
  served: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    labelKey: 'orders.served',
  },
  out_for_delivery: {
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    border: 'border-violet-300',
    labelKey: 'orders.outForDelivery',
  },
  delivered: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    labelKey: 'orders.delivered',
  },
  closed: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    labelKey: 'orders.closed',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    labelKey: 'orders.cancelled',
  },
} as const;

export const ORDER_ITEM_STATUS_BADGES: Record<OrderItemStatus, BadgeConfig> = {
  pending: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    labelKey: 'orders.pending',
  },
  preparing: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-400',
    labelKey: 'orders.preparing',
  },
  ready: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-400',
    labelKey: 'orders.ready',
  },
  served: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-400',
    labelKey: 'orders.served',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    labelKey: 'orders.cancelled',
  },
} as const;

export const USER_ROLE_BADGES: Record<UserRole, BadgeConfig> = {
  owner: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    labelKey: 'owner',
  },
  admin: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    labelKey: 'admin',
  },
  kitchen: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    labelKey: 'kitchen',
  },
  waiter: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    labelKey: 'waiter',
  },
} as const;

export const TABLE_STATUS_BADGES: Record<TableStatus, BadgeConfig> = {
  free: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    labelKey: 'tables.free',
  },
  occupied: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    labelKey: 'tables.occupied',
  },
  reserved: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    labelKey: 'tables.reserved',
  },
  closed: {
    bg: 'bg-gray-200',
    text: 'text-gray-600',
    labelKey: 'tables.closed',
  },
} as const;

export const PAYMENT_METHOD_BADGES: Record<PaymentMethod, BadgeConfig> = {
  cash: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    labelKey: 'expenses.cash',
  },
  card: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    labelKey: 'expenses.card',
  },
  digital: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    labelKey: 'expenses.digital',
  },
} as const;

/**
 * Returns Tailwind CSS classes for a staff role badge. Kept as a string
 * helper so legacy call sites (sidebar, settings) don't have to refactor;
 * routes through `USER_ROLE_BADGES` so the styling stays in one place.
 */
export function getRoleBadgeColor(role: string): string {
  const config = USER_ROLE_BADGES[role as UserRole];
  if (config) return `${config.bg} ${config.text}`;
  return 'bg-blue-100 text-blue-800';
}

/**
 * Returns Tailwind CSS classes for an order status badge/card. Routes
 * through `ORDER_STATUS_BADGES` so a new status variant is reflected
 * everywhere automatically.
 */
export function getOrderStatusColor(status: string): string {
  const config = ORDER_STATUS_BADGES[status as OrderStatus];
  if (config) {
    return config.border
      ? `${config.bg} ${config.text} border ${config.border}`
      : `${config.bg} ${config.text}`;
  }
  return 'bg-gray-100 text-gray-800';
}
