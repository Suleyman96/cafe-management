import { onlineManager } from '@tanstack/react-query';

/**
 * Tracks the last time the app was confirmed online so the mutation cache can
 * distinguish "live" failures from sync-replay failures (a queued mutation
 * resuming after reconnect). Without this, every replay error would look like
 * a fresh user action and the snackbar copy would be wrong.
 *
 * Initialized to Date.now() so app launch is treated as the most recent
 * online point — first-render errors aren't misclassified as replays.
 */
let lastOnlineAt = Date.now();

onlineManager.subscribe(() => {
  if (onlineManager.isOnline()) {
    lastOnlineAt = Date.now();
  }
});

export function getLastOnlineAt(): number {
  return lastOnlineAt;
}

/**
 * True when the device was reported offline at least once within the last
 * `withinMs` milliseconds. Used by the mutation cache to label sync-replay
 * failures.
 *
 * Caller passes the maximum age of "recently offline" they care about.
 * Default is 60s — covers the typical reconnect-and-replay window.
 */
export function wasOfflineRecently(withinMs = 60_000): boolean {
  return !onlineManager.isOnline() || Date.now() - lastOnlineAt < withinMs;
}
