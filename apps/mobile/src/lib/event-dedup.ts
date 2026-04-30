/**
 * Tiny in-memory dedup map used to suppress duplicate sound playback when the
 * same event arrives via two channels (Supabase Realtime + Expo push). The
 * realtime path marks the event id; the foreground push handler checks before
 * deciding whether to play the in-app sound.
 *
 * Cleanup runs lazily on every check — entries older than 5s are evicted so
 * the map never grows unbounded.
 */

const recent = new Map<string, number>();
const MAX_AGE_MS = 5_000;

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
  pruneOlderThan(MAX_AGE_MS, now);
  const ts = recent.get(id);
  if (ts === undefined) return false;
  return now - ts < windowMs;
}

export function __resetEventDedupForTests(): void {
  recent.clear();
}
