import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic helpers. expo-haptics promises can reject on devices
 * without a vibrator (rare) or while the screen is off — we never want a
 * silent reject to surface as an unhandled rejection or to block the caller.
 *
 * Two semantics are intentional:
 * - `hapticEvent` for incoming-attention signals (new order, waiter call) so
 *   staff feel the event in a noisy kitchen even if the speaker is muffled.
 * - `hapticSuccess` for action confirmations (payment recorded, call accepted)
 *   so the staff member knows their tap registered without staring at a toast.
 *
 * Mobile audit #6 — coalesce calls to ≤ 1 buzz / 300 ms per haptic type,
 * mirroring `sound.ts`. A 5-events-in-200ms burst (post-reconnect replay,
 * printer-driven catchup) would otherwise queue up vibrations on the
 * CoreHaptics / Vibrator OS resource and the device buzzes for seconds. The
 * 300 ms floor matches the sound coalescer so a single "incoming order"
 * cue is one sound + one haptic regardless of burst rate.
 */

const MIN_GAP_MS = 300;
const lastFiredAt = new Map<string, number>();

function shouldFire(key: string, now: number = Date.now()): boolean {
  const last = lastFiredAt.get(key) ?? 0;
  if (now - last < MIN_GAP_MS) return false;
  lastFiredAt.set(key, now);
  return true;
}

/** Test-only: reset the per-key timestamps so coalescing windows don't leak between tests. */
export function __resetHapticCoalescingForTests(): void {
  lastFiredAt.clear();
}

export function hapticEvent(): void {
  if (!shouldFire('event')) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
    // Device has no haptics or the call was rejected — not worth surfacing.
  });
}

export function hapticSuccess(): void {
  if (!shouldFire('success')) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // See above.
  });
}
