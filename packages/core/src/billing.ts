/**
 * Billing-cadence helpers (headless).
 *
 * Billing cadence (monthly vs yearly) is ORTHOGONAL to the plan tier: both
 * cadences buy the same capabilities (PLAN_LIMITS is keyed by tier only), they
 * differ only in price and renewal interval. These helpers compute the
 * paid-through date (`tenants.current_period_end`) from a cadence and derive a
 * client-facing renewal status from that date.
 *
 * Pure + runtime-agnostic on purpose (no React/Supabase): the same logic runs
 * in the platform console (UI status chips + banner), the platform API routes
 * (period-end computation) and the scheduled reminder job.
 */

export type BillingCycle = 'monthly' | 'yearly';

/** Renewal status derived from the paid-through date, relative to "now". */
export type BillingStatus = 'active' | 'expiring_soon' | 'overdue';

/**
 * Console threshold: a tenant is "expiring soon" when the paid-through date is
 * this many days away or fewer (but still in the future). Past that window it
 * reads as "active".
 */
export const BILLING_EXPIRING_SOON_DAYS = 14;

/**
 * Reminder threshold: the scheduled job emails the operator about paid tenants
 * whose paid-through date is this many days away or fewer, plus any already
 * overdue. Tighter than the console window (the banner is the primary nudge;
 * the email is the last-mile catch).
 */
export const BILLING_REMINDER_DAYS = 7;

const MS_PER_DAY = 86_400_000;

/**
 * Add whole calendar months to a date in UTC, clamping the day-of-month so an
 * end-of-month start never silently skips a month (e.g. Jan 31 + 1 month →
 * Feb 28/29, not Mar 2/3).
 */
export function addMonthsUTC(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const d = new Date(date.getTime());
  // Pin to the 1st before shifting the month so the intermediate value can't
  // overflow into the next month, then restore the (clamped) day.
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTargetMonth));
  return d;
}

/**
 * Compute the paid-through date for a cadence: `from` + 1 month (monthly) or
 * + 12 months (yearly). `from` defaults to now.
 */
export function computePeriodEnd(cycle: BillingCycle, from: Date = new Date()): Date {
  return addMonthsUTC(from, cycle === 'yearly' ? 12 : 1);
}

/**
 * Derive the renewal status from a paid-through date.
 *
 * Returns `null` when there is no date (free/unset tenants, or a paid tenant
 * whose cadence hasn't been recorded yet) — callers render no billing chip in
 * that case. `overdue` when the date is in the past, `expiring_soon` when it is
 * within `expiringSoonDays`, otherwise `active`.
 */
export function deriveBillingStatus(
  periodEnd: string | Date | null | undefined,
  now: Date = new Date(),
  expiringSoonDays: number = BILLING_EXPIRING_SOON_DAYS,
): BillingStatus | null {
  if (!periodEnd) return null;
  const end = typeof periodEnd === 'string' ? new Date(periodEnd) : periodEnd;
  if (Number.isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  const diffDays = diffMs / MS_PER_DAY;
  if (diffDays <= expiringSoonDays) return 'expiring_soon';
  return 'active';
}

/**
 * Whether a paid-through date needs operator attention (expiring soon or
 * overdue) within the given window. Used by the console banner count and the
 * scheduled reminder job.
 */
export function billingNeedsAttention(
  periodEnd: string | Date | null | undefined,
  now: Date = new Date(),
  withinDays: number = BILLING_EXPIRING_SOON_DAYS,
): boolean {
  const status = deriveBillingStatus(periodEnd, now, withinDays);
  return status === 'expiring_soon' || status === 'overdue';
}
