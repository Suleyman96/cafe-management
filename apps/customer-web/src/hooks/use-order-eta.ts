import { useEffect, useRef, useState } from 'react';
import { useMenuItems } from '@/hooks/use-menu';
import type { OrderItem, OrderStatus } from '@/types';

/**
 * M6 — customer-facing ETA for an in-flight order.
 *
 * Reads each `order_item`'s `menu_item.preparation_time` via the shared
 * `useMenuItems` cache (tenant-scoped, 5-min stale), joins on
 * `menu_item_id`, and computes a remaining-minutes estimate based on
 * order status:
 *   - `pending_approval` / `new`: longest prep time across non-cancelled
 *     items. Customer hasn't started waiting in any meaningful sense yet.
 *   - `preparing`: same baseline, but counts down from `created_at`. So
 *     a 15-minute prep that started 10 minutes ago reads as ~5 min.
 *   - anything else (`ready`, `served`, terminal): no ETA — the existing
 *     status banner already says the right thing.
 *
 * Returns `null` whenever we can't be confident (missing menu items,
 * missing prep_time on any contributing item, terminal status). The
 * consumer renders the legacy "We're preparing your order" copy on
 * `null` so a stale-cache or migration gap never leaves the customer
 * staring at a misleading countdown.
 *
 * Tick: re-renders every 30s while in the `preparing` state via a
 * `setInterval`. We avoid running the timer in non-preparing states so
 * an order that's been "ready" for an hour doesn't keep waking React.
 *
 * H2 — ratchet the elapsed-min reading forward-only via a per-orderId
 * ref. Two failure modes the raw `now - createdAt` math is vulnerable to:
 *   - Phone-clock skew (iOS just woke from sleep, `Date.now()` lags
 *     before NTP sync). `elapsedMin` can be negative; `minutesRemaining`
 *     jumps **up**.
 *   - Staff reopens / re-times the order downstream, mutating
 *     `created_at`. The customer sees the countdown reset.
 * Storing the highest previously-observed `elapsedMin` (per orderId)
 * and clamping to `max(prev, current)` makes the countdown monotonic
 * across both cases. The ref resets on `orderId` change so a different
 * order doesn't inherit the prior order's progress.
 */
export interface OrderEta {
  /** Whole minutes remaining (clamped at 0). */
  minutes: number;
  /** True when remaining < 2 — caller picks a punchier copy. */
  almostReady: boolean;
}

export function useOrderEta(
  orderItems: OrderItem[] | undefined,
  status: OrderStatus | undefined,
  createdAt: string | null | undefined,
  orderId?: string | null,
): OrderEta | null {
  const { data: menuItems } = useMenuItems();
  // Tick state — re-evaluates the countdown every 30s. Stored as a
  // millisecond-resolution number so the equality check below ticks
  // correctly even when the countdown is updating one minute at a time.
  const [now, setNow] = useState(() => Date.now());

  const shouldTick = status === 'preparing';
  useEffect(() => {
    if (!shouldTick) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [shouldTick]);

  // H2 — per-orderId ratchet. The ref tracks the highest elapsedMin we've
  // observed for the current order; on a clock-skew or `created_at`
  // refresh, we keep returning the larger value so the countdown only
  // ever ratchets forward. The wrapping object lets us null out the
  // orderId when it changes (cleanest reset semantics).
  const ratchetRef = useRef<{ orderId: string | null | undefined; maxElapsedMin: number }>({
    orderId,
    maxElapsedMin: 0,
  });
  if (ratchetRef.current.orderId !== orderId) {
    ratchetRef.current = { orderId, maxElapsedMin: 0 };
  }

  if (!orderItems || !menuItems || orderItems.length === 0) return null;
  if (status === 'ready' || status === 'served') return null;
  if (status === 'closed' || status === 'cancelled') return null;
  if (status === 'out_for_delivery' || status === 'delivered') return null;
  if (status !== 'pending_approval' && status !== 'new' && status !== 'preparing') return null;

  const prepTimeById = new Map<string, number | null>();
  for (const mi of menuItems) {
    prepTimeById.set(mi.id, mi.preparation_time ?? null);
  }

  let longestPrep = 0;
  for (const item of orderItems) {
    if (item.status === 'cancelled') continue;
    const prep = prepTimeById.get(item.menu_item_id);
    // Fall back to legacy banner when any contributing item lacks a
    // prep_time — we don't want to silently understate the ETA by
    // pretending unknown items are instant.
    if (prep == null) return null;
    if (prep > longestPrep) longestPrep = prep;
  }
  if (longestPrep <= 0) return null;

  let minutesRemaining: number;
  if (status === 'preparing' && createdAt) {
    const elapsedMs = now - new Date(createdAt).getTime();
    const rawElapsedMin = Math.floor(elapsedMs / 60_000);
    // H2 — clamp to the ratchet so a clock skew or `created_at` refresh
    // can't drive the countdown backwards. The ratchet always grows.
    const effectiveElapsedMin = Math.max(rawElapsedMin, ratchetRef.current.maxElapsedMin);
    ratchetRef.current.maxElapsedMin = effectiveElapsedMin;
    minutesRemaining = Math.max(0, longestPrep - effectiveElapsedMin);
  } else {
    // pending_approval / new — the kitchen hasn't started yet, so the
    // ETA is the prep baseline.
    minutesRemaining = longestPrep;
  }

  return {
    minutes: minutesRemaining,
    almostReady: minutesRemaining < 2,
  };
}
