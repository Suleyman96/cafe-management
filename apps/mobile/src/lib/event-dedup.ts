/**
 * Tiny in-memory dedup map used to suppress duplicate sound playback. Two
 * lookup windows share one map:
 *
 *   - Realtime↔push race (default 500 ms). The realtime path marks the
 *     event id; the foreground push handler checks before deciding whether
 *     to play the in-app sound when the same event is delivered via both
 *     channels within the same hand-off window.
 *
 *   - Reconnect-replay / OS re-delivery (60 s, audit #5 + #7). Realtime
 *     can re-deliver an INSERT after a brief disconnect; the OS notification
 *     system can re-deliver the same notification request id during boot or
 *     reinstall. Either path would otherwise re-fire the kitchen sound for
 *     an already-seen event.
 *
 * Cleanup runs lazily on every check — entries older than the longest
 * in-use window are evicted so the map never grows unbounded.
 */

const recent = new Map<string, number>();

/**
 * Retention floor. Bumped from 5 s to 60 s in audit #5/#7 so the map
 * survives reconnect-replay and OS-re-delivery dedup windows. At a busy
 * kitchen rate of 1 event/sec this caps the map at ~60 entries — well
 * within in-memory budget for a phone.
 */
const MAX_AGE_MS = 60_000;

function pruneOlderThan(thresholdMs: number, now: number = Date.now()) {
  for (const [key, ts] of recent) {
    if (now - ts > thresholdMs) recent.delete(key);
  }
}

export function markEvent(id: string, now: number = Date.now()): void {
  recent.set(id, now);
  pruneOlderThan(MAX_AGE_MS, now);
}

export function seenRecently(id: string, windowMs = 500, now: number = Date.now()): boolean {
  // Prune at max(MAX_AGE_MS, windowMs) so callers requesting longer windows
  // don't trip over the default 60 s floor.
  pruneOlderThan(Math.max(MAX_AGE_MS, windowMs), now);
  const ts = recent.get(id);
  if (ts === undefined) return false;
  return now - ts < windowMs;
}

export function __resetEventDedupForTests(): void {
  recent.clear();
}
