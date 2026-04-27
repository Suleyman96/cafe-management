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
 */

export function hapticEvent(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
    // Device has no haptics or the call was rejected — not worth surfacing.
  });
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // See above.
  });
}
