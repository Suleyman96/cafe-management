/**
 * Shared Constants
 * Used across all platforms
 */

// Re-export all DB enums from the single source of truth
export {
  CURRENCY_POSITION,
  EXPENSE_PAYMENT_METHOD,
  FEEDBACK_STATUS,
  FEEDBACK_TYPE,
  ORDER_ITEM_STATUS,
  ORDER_SOURCE,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  REFUND_METHOD,
  SCHEDULE_STATUS,
  STOCK_MOVEMENT_TYPE,
  STOCK_UNIT,
  TABLE_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  TASK_STATUS,
  USER_ROLE,
  WAITER_CALL_PRIORITY,
  WAITER_CALL_REASON,
  WAITER_CALL_STATUS,
  WASTE_REASON,
} from '@gustri/database';

// Active order status sets — used to filter "in-progress" orders by order type
export const ACTIVE_ORDER_STATUSES = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'served',
] as const;

export const ACTIVE_TAKEOUT_STATUSES = ['pending_approval', 'new', 'preparing', 'ready'] as const;

export const ACTIVE_DELIVERY_STATUSES = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'out_for_delivery',
] as const;

// Waiter call reasons (UI-specific with labels and emojis)
export const WAITER_CALL_REASONS = [
  { value: 'assistance', label: 'General Help', emoji: '💬' },
  { value: 'bill', label: 'Request Bill', emoji: '🧾' },
  { value: 'question', label: 'Question', emoji: '❓' },
  { value: 'complaint', label: 'Complaint', emoji: '⚠️' },
  { value: 'emergency', label: 'Emergency', emoji: '🚨' },
] as const;

/** Default tax percentage used when cafe settings haven't loaded yet */
export const DEFAULT_TAX_PERCENTAGE = 0;

// Refresh intervals (ms)
//
// `FALLBACK` is the steady-state safety-net poll used while realtime is healthy
// or in soft retry — slow on purpose, since the WS should be doing the work.
// `DEGRADED_FALLBACK` is the active-recovery poll: once a channel exhausts its
// retry budget and goes `degraded`, mobile flips to this faster cadence so the
// kitchen/waiter screens don't blackout for two minutes during service.
export const REFRESH_INTERVALS = {
  ORDERS: 30000, // 30 seconds
  KITCHEN: 10000, // 10 seconds
  WAITER_CALLS: 15000, // 15 seconds
  TABLES: 60000, // 1 minute
  FALLBACK: 120000, // 2 minutes — safety-net poll when realtime WS is disconnected
  DEGRADED_FALLBACK: 20000, // 20 seconds — active-recovery poll while channel is degraded
} as const;

// Status colors
export const STATUS_COLORS = {
  pending_approval: '#D97706', // amber-600
  new: '#EF4444', // red-500
  preparing: '#F59E0B', // amber-500
  ready: '#10B981', // green-500
  served: '#6B7280', // gray-500
  closed: '#374151', // gray-700
  out_for_delivery: '#8B5CF6', // purple-500
  delivered: '#10B981', // green-500
  cancelled: '#9CA3AF', // gray-400
} as const;

// Subscription plan types and limits
export type PlanName = 'free' | 'standard' | 'pro' | 'business';

export const PLAN_LIMITS = {
  free: {
    maxTables: 5,
    maxOrdersPerMonth: 100,
    qrOrdering: false,
    kitchenDisplay: true,
    inventory: false,
    waste: false,
    scheduling: false,
    tasks: false,
    customBranding: false,
    analytics: 'basic' as const,
  },
  standard: {
    maxTables: 10,
    maxOrdersPerMonth: 700,
    qrOrdering: true,
    kitchenDisplay: true,
    inventory: false,
    waste: false,
    scheduling: false,
    tasks: false,
    customBranding: true,
    analytics: 'full' as const,
  },
  pro: {
    maxTables: 20,
    maxOrdersPerMonth: 2200,
    qrOrdering: true,
    kitchenDisplay: true,
    inventory: true,
    waste: true,
    scheduling: true,
    tasks: true,
    customBranding: true,
    analytics: 'full' as const,
  },
  business: {
    maxTables: -1,
    maxOrdersPerMonth: -1,
    qrOrdering: true,
    kitchenDisplay: true,
    inventory: true,
    waste: true,
    scheduling: true,
    tasks: true,
    customBranding: true,
    analytics: 'full' as const,
  },
} as const;

export const PLAN_ORDER: Record<PlanName, number> = { free: 0, standard: 1, pro: 2, business: 3 };

// 30-minute interval time slots (00:00 to 23:30)
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

// Weekdays with Sunday=0 (matches JS Date.getDay())
export const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

// Weekdays with Sunday=7 (1-7 numbering for recurrence)
export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

/** Maps order status enum values to i18n translation keys */
export const ORDER_STATUS_KEYS: Record<string, string> = {
  pending_approval: 'orders.pendingApproval',
  new: 'orders.new',
  preparing: 'orders.preparing',
  ready: 'orders.ready',
  served: 'orders.served',
  out_for_delivery: 'orders.outForDelivery',
  delivered: 'orders.delivered',
  closed: 'orders.closed',
  cancelled: 'orders.cancelled',
};

// Time-elapsed color thresholds (minutes) — shared across web & mobile kitchen displays
export const TIME_ELAPSED_THRESHOLDS = {
  WARNING: 10, // yellow/amber
  ELEVATED: 15, // orange
  CRITICAL: 20, // red
} as const;

/**
 * Per-role cap on discount magnitude (as a fraction of order subtotal).
 *
 * `discount-service.ts` enforces this server-side before applying any
 * `percentage`/`fixed` discount; mobile mirrors it as a UX courtesy. A
 * waiter applying a 99% "fixed" discount is economically a refund, which
 * already requires admin role — so the cap closes the parallel hole on the
 * discount path.
 *
 *  - waiter:  10% — service recovery (cold coffee, slow kitchen)
 *  - kitchen:  0% — no discount authority
 *  - admin: 100% — owner/admin can comp the entire order
 *  - owner: 100% — same
 *
 * Tenants with a stricter policy can override via
 * `tenant_settings.max_discount_percent_<role>` (added in a follow-up
 * migration). Until then this hard table is the floor.
 */
export const DISCOUNT_CAPS_BY_ROLE: Record<string, number> = {
  waiter: 0.1,
  kitchen: 0,
  admin: 1.0,
  owner: 1.0,
};

/** Threshold above which a discount writes a financial_audit_log entry. */
export const DISCOUNT_AUDIT_THRESHOLD = 0.2;

export function getDiscountCapForRole(role: string | null | undefined): number {
  if (role && role in DISCOUNT_CAPS_BY_ROLE) return DISCOUNT_CAPS_BY_ROLE[role]!;
  return 0;
}

/**
 * Auto-logout window per role. Shared devices in the kitchen / waiter station
 * shouldn't sit unlocked for an admin's worth of time after the last user
 * walked away, so we tighten the budget by responsibility tier:
 *
 * - kitchen: 15min  — public tablets, lowest privilege but high data exposure
 * - waiter:  30min  — handheld but easy to drop on a table mid-shift
 * - admin:   60min  — usually the owner's personal device
 * - owner:   60min  — same
 *
 * The mobile inactivity hook reads this map by `staff.role` on every
 * AppState resume and on cold start. Default to the most restrictive
 * (15 min) when role is missing, since "unknown" is closer to "kitchen
 * tablet" than "owner laptop" in our threat model.
 */
export const INACTIVITY_TIMEOUTS_BY_ROLE = {
  kitchen: 15 * 60 * 1000,
  waiter: 30 * 60 * 1000,
  admin: 60 * 60 * 1000,
  owner: 60 * 60 * 1000,
} as const;

export const DEFAULT_INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUTS_BY_ROLE.kitchen;

export type InactivityTimeoutRole = keyof typeof INACTIVITY_TIMEOUTS_BY_ROLE;

export function getInactivityTimeoutMs(role: string | null | undefined): number {
  if (role && role in INACTIVITY_TIMEOUTS_BY_ROLE) {
    return INACTIVITY_TIMEOUTS_BY_ROLE[role as InactivityTimeoutRole];
  }
  return DEFAULT_INACTIVITY_TIMEOUT_MS;
}

// UI constants
export const UI = {
  MIN_TOUCH_TARGET: 44, // 44x44px minimum
  MAX_CONTENT_WIDTH: 1200,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
} as const;
