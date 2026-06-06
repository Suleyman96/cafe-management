/**
 * Tiny in-memory dedup map used to suppress duplicate sound playback. Two
 * lookup windows share one map:
 *
 *   - Realtime↔push race (default 500 ms). The realtime path marks the
 *     event id; the foreground push handler checks before deciding whether
 *     to play the in-app sound when the same event is delivered via both
 *     channels within the same hand-off window.
 *
 *   - Reconnect-replay (300 s, audit C2). Realtime can re-deliver an
 *     INSERT after the WS drops and reconnects — typical when a phone
 *     pockets/unpockets between tables for 2-3 minutes. The original
 *     delivery is now well outside the prior 60 s dedup window, so the
 *     kitchen rings twice for the same order. The 5-minute window covers
 *     the realistic between-tables gap; longer disconnections fall back to
 *     the realtime channel's degraded-poll catch-up path.
 *
 *   - OS re-delivery (60 s, audit #7). Expo / FCM / APNs can re-invoke the
 *     foreground notification handler with the same `request.identifier`
 *     during reconnect, app boot, or rare OS retry paths. Window lives at
 *     the call site (`notifications.ts`) since the trigger is independent
 *     of realtime backlog.
 *
 * Cleanup runs lazily on every check — entries older than the longest
 * in-use window are evicted, and a soft size cap drops the oldest beyond
 * 1000 entries as belt-and-braces against pathological pinned-id loops.
 */

const recent = new Map<string, number>();

/**
 * Reconnect-replay lookup window. Exported so the realtime `onPayload`
 * callers (`use-orders.ts`, `use-waiter-calls.ts`) align their dedup
 * lookup with the retention floor below — drift between the two
 * reintroduces the bug this constant exists to prevent.
 */
export const RECONNECT_REPLAY_WINDOW_MS = 300_000;

/**
 * Retention floor. Bumped from 60 s to 300 s in audit C2 so reconnect
 * replays beyond the prior 60 s window dedup against the original
 * delivery. At a busy kitchen rate of 1 event/sec this puts the working
 * set at ~300 entries — well within in-memory budget. The soft cap below
 * is the safety net for runaway growth.
 */
const MAX_AGE_MS = RECONNECT_REPLAY_WINDOW_MS;

/**
 * Soft cap on map size. Age-based pruning holds the working set to a few
 * hundred entries on a normal shift; the cap protects against a half-
 * broken realtime channel that re-fires the same id on a tight loop.
 * 1000 entries ≈ ~16 minutes of headroom at the busy-kitchen rate.
 */
const MAX_ENTRIES = 1000;

function pruneOlderThan(thresholdMs: number, now: number) {
  for (const [key, ts] of recent) {
    if (now - ts > thresholdMs) recent.delete(key);
  }
}

function applySoftCap() {
  while (recent.size > MAX_ENTRIES) {
    const oldestKey = recent.keys().next().value;
    if (oldestKey === undefined) break;
    recent.delete(oldestKey);
  }
}

export function markEvent(id: string, now: number = Date.now()): void {
  // Delete-before-set so a refreshed entry moves to the end of iteration
  // order. Map preserves insertion order, and `applySoftCap` evicts via
  // that order — without this, a long-pinned id would be evicted as if it
  // were stale even though it was just refreshed.
  recent.delete(id);
  recent.set(id, now);
  pruneOlderThan(MAX_AGE_MS, now);
  applySoftCap();
}

export function seenRecently(id: string, windowMs = 500, now: number = Date.now()): boolean {
  // Prune at max(MAX_AGE_MS, windowMs) so callers requesting longer
  // windows don't trip over the 300 s floor.
  pruneOlderThan(Math.max(MAX_AGE_MS, windowMs), now);
  const ts = recent.get(id);
  if (ts === undefined) return false;
  return now - ts < windowMs;
}

/**
 * Reconnect-replay gate for realtime INSERT handlers (audit #5 + C2).
 *
 * Checks whether `id` was seen within {@link RECONNECT_REPLAY_WINDOW_MS}, then
 * marks it — mark-BEFORE-play so a near-simultaneous push delivery of the same
 * event suppresses its own sound via `seenRecently`. Returns true when this is a
 * replay whose side effects (sound/notify) the caller should skip.
 *
 * Consolidates the byte-identical dedup blocks in `use-orders.ts` and
 * `use-waiter-calls.ts` so the check + mark + window stay in lock-step.
 */
export function consumeReconnectReplay(id: string, now: number = Date.now()): boolean {
  const isReplay = seenRecently(id, RECONNECT_REPLAY_WINDOW_MS, now);
  markEvent(id, now);
  return isReplay;
}

export function __resetEventDedupForTests(): void {
  recent.clear();
}
