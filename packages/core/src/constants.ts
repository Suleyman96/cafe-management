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

import type { OrderItemStatus } from '@gustri/database';

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

/**
 * Order statuses where cancellation is "expensive" — the kitchen has already
 * invested labor (cooking in progress / cooked / served / sent for delivery).
 * The web `CancelOrderModal` requires a type-to-confirm phrase before
 * enabling submit when status is in this set, mirroring the refund/discount
 * type-to-confirm pattern. `pending_approval`/`new` are excluded — those
 * statuses are still "free" to cancel and the friction would be busywork.
 */
export const ORDER_STATUSES_REQUIRING_CANCEL_TYPE_CONFIRM = [
  'preparing',
  'ready',
  'served',
  'out_for_delivery',
] as const;

/**
 * Returns `true` when cancelling an order in this status should be gated
 * behind the type-to-confirm phrase ("CANCEL <order_number>"). See
 * `ORDER_STATUSES_REQUIRING_CANCEL_TYPE_CONFIRM` for the rationale.
 */
export function orderCancellationRequiresTypeConfirm(status: string): boolean {
  return (ORDER_STATUSES_REQUIRING_CANCEL_TYPE_CONFIRM as readonly string[]).includes(status);
}

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

/**
 * Fallback for `tenant.refund_type_to_confirm_threshold` when cafe settings
 * haven't loaded: refunds/discount overrides at or above this amount require
 * the type-to-confirm friction (see CLAUDE.md "Destructive-action
 * confirmations"). Shared by the refund + discount modals so the threshold
 * can't drift between the two.
 */
export const DEFAULT_REFUND_TYPE_CONFIRM_THRESHOLD = 100;

/**
 * How long after going offline a recently-failed mutation is treated as
 * "queued for retry" rather than a hard failure. Mutation error handlers
 * read `wasOfflineRecently(OFFLINE_SYNC_WINDOW_MS)` to phrase the user-
 * facing message ("Failed to sync queued change: …") and to set the Sentry
 * tag `context: offline-sync-replay`, so a paused-then-replayed mutation
 * doesn't get reported the same way as a fresh interactive failure.
 *
 * Tuned to cover the worst-case re-online → replay drain seen in the wild:
 * the radio re-attaches, onlineManager fires, and the persister flushes
 * pending mutations — that whole sequence completes well under 60s on the
 * slowest networks we've measured. Raising this would mask real failures;
 * lowering it would misclassify legit replay errors as fresh ones.
 */
export const OFFLINE_SYNC_WINDOW_MS = 60_000;

/**
 * Persisted query-cache schema version. Bump when the persisted cache shape
 * changes incompatibly — i.e. when old serialized payloads cannot be safely
 * deserialized into the new client (renamed field on a persisted entity,
 * removed nested column, narrowed enum, mutation-meta contract change).
 *
 * Mobile composes a per-release buster as `${CACHE_SCHEMA_VERSION}-${appVersion}`
 * so any release with a fresh bundle also drops the cache, even if the
 * developer forgot to bump. Web persistence (when added) must consume the
 * same constant so a coordinated bump here invalidates every client at once.
 *
 * Bump history:
 *  - v1: initial persisted cache shape.
 *  - v2: ...
 *  - v3: C2 added required `meta.tenantId` + `meta.staffId` on every persisted
 *        mutation; pre-C2 caches don't carry the stamp.
 */
export const CACHE_SCHEMA_VERSION = 3;

/**
 * Polling intervals for query fallbacks (ms). Consumed by both web and
 * mobile. Platforms may halve these values when backgrounded; do not raise
 * them without checking battery impact on mobile (each poll wakes the radio
 * on cellular).
 *
 * Realtime is the primary freshness path on every screen — these intervals
 * are safety nets for the WS dropping or going degraded.
 *
 * `FALLBACK` is the steady-state safety-net poll used while realtime is
 * healthy or in soft retry — slow on purpose, since the WS should be doing
 * the work.
 *
 * `DEGRADED_FALLBACK` is the active-recovery poll: once a channel exhausts
 * its retry budget and goes `degraded`, mobile flips to this faster cadence
 * so the kitchen/waiter screens don't black out for two minutes during
 * service.
 */
export const REFRESH_INTERVALS = {
  /** Orders list view — covers most non-kitchen workflows. */
  ORDERS: 30000, // 30 seconds
  /** Kitchen display — tightest cadence; staff watch this in real time. */
  KITCHEN: 10000, // 10 seconds
  /** Waiter-call surfacing on tables/calls screens. */
  WAITER_CALLS: 15000, // 15 seconds
  /** Tables grid — slow on purpose, status only changes on order events. */
  TABLES: 60000, // 1 minute
  /** Steady-state safety-net poll when realtime WS is disconnected. */
  FALLBACK: 120000, // 2 minutes
  /** Active-recovery poll while a channel is in `degraded` state (H1). */
  DEGRADED_FALLBACK: 20000, // 20 seconds
} as const;

// Subscription plan types and limits
export type PlanName = 'free' | 'standard' | 'pro' | 'business';

export const PLAN_LIMITS = {
  free: {
    // Real trial: QR ordering ON (custom_branding off → "Powered by gustri" on
    // the QR menu = free marketing), 500 orders/mo so a micro-cafe can run on it.
    maxTables: 5,
    maxOrdersPerMonth: 500,
    qrOrdering: true,
    kitchenDisplay: true,
    inventory: false,
    waste: false,
    scheduling: false,
    tasks: false,
    customBranding: false,
    analytics: 'basic' as const,
  },
  standard: {
    // No order cap on paid tiers: a hard mid-month cap would stop a paying
    // cafe's POS during service. Differentiate on tables + features.
    maxTables: 15,
    maxOrdersPerMonth: -1,
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
    maxTables: 40,
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
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 0 },
] as const;

// Weekdays with Sunday=7 (1-7 numbering for recurrence)
export const WEEKDAYS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 7 },
] as const;

/**
 * Maps a day-of-week numeric value to its translation key in the `staff`
 * namespace. Handles both numbering conventions in this file:
 *   - `DAYS_OF_WEEK` → 0..6 with Sunday=0 (matches `Date.getDay()`).
 *   - `WEEKDAYS`     → 1..7 with Sunday=7 (recurrence-style).
 *
 * Both `0` and `7` map to `weekdays.sun` so the same map works regardless
 * of which constant the consumer iterated. The `weekdays.*` keys are
 * translated for all 20 locales — never render the day value as text;
 * always go through `t(WEEKDAY_TRANSLATION_KEY[day.value])`.
 */
export const WEEKDAY_TRANSLATION_KEY: Record<number, string> = {
  0: 'weekdays.sun',
  1: 'weekdays.mon',
  2: 'weekdays.tue',
  3: 'weekdays.wed',
  4: 'weekdays.thu',
  5: 'weekdays.fri',
  6: 'weekdays.sat',
  7: 'weekdays.sun',
};

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
 * Canonical urgency-band classification for a kitchen ticket. Both web
 * (apps/staff-web/.../kitchen/page.tsx) and mobile (KitchenOrderCard.tsx)
 * currently inline equivalent — but subtly divergent — band logic:
 *
 *   - Web's `getCardBg` returns the "warning" band even for orders at
 *     minute 0 (no fallback below WARNING).
 *   - Web's inline elapsed-pill bg uses `>` (strict) where everything else
 *     uses `>=`, so the band flips one minute later.
 *   - Mobile uses `>=` consistently and returns a distinct "default" band
 *     for orders below WARNING.
 *
 * This helper is the single source of truth. New code MUST use it;
 * existing inline implementations should migrate to it during the kitchen
 * urgency work (MOBILE_PARITY_PLAN.md Phase 1.1) so the visual hierarchy
 * is identical on both platforms — the operational guarantee that
 * Phase 5.1/5.3/5.4 exists to verify.
 *
 * Precedence (highest → lowest):
 *   ready (all items done / status=ready) >
 *   new (untriaged) >
 *   critical (>= 20 min) >
 *   elevated (>= 15 min) >
 *   warning (>= 10 min) >
 *   default (< 10 min)
 */
export type KitchenUrgencyBand = 'ready' | 'new' | 'critical' | 'elevated' | 'warning' | 'default';

export interface KitchenUrgencyInput {
  /** Minutes elapsed since `order.created_at`. Negative values clamp to 0. */
  minutesElapsed: number;
  /** Current `order.status`. */
  status: string;
  /**
   * Optional: true when every non-served / non-cancelled order item is in
   * the `ready` state. Lets a "preparing"-status order with all items
   * actually ready render as `ready` (mobile already does this).
   */
  allItemsReady?: boolean;
}

export function getKitchenUrgencyBand(input: KitchenUrgencyInput): KitchenUrgencyBand {
  const minutes = Math.max(0, input.minutesElapsed);
  if (input.allItemsReady || input.status === 'ready') return 'ready';
  if (input.status === 'new') return 'new';
  if (minutes >= TIME_ELAPSED_THRESHOLDS.CRITICAL) return 'critical';
  if (minutes >= TIME_ELAPSED_THRESHOLDS.ELEVATED) return 'elevated';
  if (minutes >= TIME_ELAPSED_THRESHOLDS.WARNING) return 'warning';
  return 'default';
}

/**
 * Item-status progression order for the kitchen per-station bulk-advance check.
 * `cancelled` is excluded (= -1) — cancellation is terminal but does not block
 * the rest of an order from progressing. Shared by the staff-web and mobile
 * kitchen so the two platforms agree on what counts as "at or past" a status.
 */
export const ITEM_STATUS_PROGRESS: Record<OrderItemStatus, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  cancelled: -1,
};

/** True when `actual` item-status is at or beyond `target` in the progression. */
export function isItemStatusAtOrPast(actual: OrderItemStatus, target: OrderItemStatus): boolean {
  return ITEM_STATUS_PROGRESS[actual] >= ITEM_STATUS_PROGRESS[target];
}

/**
 * Threshold above which a discount additionally requires a non-trivial
 * `discount_reason`. The discount endpoint is admin-only, so this is a
 * forensic-quality gate rather than an authorization gate — large comps
 * must carry a reason so finance reconciliation has context.
 */
export const DISCOUNT_AUDIT_THRESHOLD = 0.2;

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
