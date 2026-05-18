'use client';

/**
 * Server-anchored clock for time-sensitive operational UI — kitchen
 * elapsed-time, "is this order overdue", urgency bands.
 *
 * Problem this exists to solve: kitchen kiosks can drift (NTP disabled,
 * battery-backed RTC, daylight-savings mis-config). When the kitchen view
 * used `Date.now()` directly, a +10 min device showed every freshly-placed
 * order as already-overdue and re-prioritised the entire kitchen against
 * reality. Restaurant staff have no way to notice the drift; they just see
 * "the system says these are late."
 *
 * Approach: sample the server's `ts` from `/api/v1/health` periodically and
 * cache the offset (`serverNow - clientNow`). Estimate the canonical "now"
 * as `Date.now() + offset` from any caller. The offset itself doubles as
 * the skew metric the kitchen banner surfaces when it exceeds the threshold.
 *
 * Why module-level state (not React Context): the leaf ElapsedTime card
 * reads this every 30s × 30+ cards × full-shift duration. Context would
 * force a re-render of every consumer on each refresh. Module state lets
 * reads be O(1) function calls; a small subscribe/notify emits ONLY to
 * the banner observer that actually cares about the offset changing.
 *
 * Symmetric-latency offset estimate: the server timestamps the response
 * at some point between fetch-start and fetch-end on the client. We
 * centre the estimate at the midpoint of the round-trip. Worst-case
 * error is bounded by the round-trip half-time (typically <100ms on a
 * healthy network), which is well below the 1-minute granularity of the
 * kitchen UI. Clock drift between syncs is also bounded (<1ms/sec on
 * modern devices) so a 5-minute resync interval keeps the estimate
 * within ~300ms.
 */

interface ClockSnapshot {
  /** `serverNow - clientNow` at last sync. Positive = server ahead. */
  offsetMs: number;
  /** `Date.now()` at the moment of last successful sync. 0 if never synced. */
  lastSyncedAt: number;
}

const INITIAL_SNAPSHOT: ClockSnapshot = { offsetMs: 0, lastSyncedAt: 0 };

let snapshot: ClockSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Best estimate of the server's current wall-clock time, in ms since epoch. */
export function getServerNow(): number {
  return Date.now() + snapshot.offsetMs;
}

/** Stable snapshot for `useSyncExternalStore` consumers. */
export function getClockSnapshot(): ClockSnapshot {
  return snapshot;
}

/** SSR snapshot — must be referentially stable so React doesn't loop. */
export function getServerClockSnapshotForSSR(): ClockSnapshot {
  return INITIAL_SNAPSHOT;
}

/**
 * Record a fresh server-time sample. `clientFetchStartedAt` and
 * `clientFetchEndedAt` come from `performance.now()` or `Date.now()`
 * bracketing the request.
 */
export function setSyncedAnchor(
  serverTimeIso: string,
  clientFetchStartedAt: number,
  clientFetchEndedAt: number,
): void {
  const serverMs = new Date(serverTimeIso).getTime();
  if (Number.isNaN(serverMs)) return;
  const clientMidFetchMs = (clientFetchStartedAt + clientFetchEndedAt) / 2;
  snapshot = {
    offsetMs: serverMs - clientMidFetchMs,
    lastSyncedAt: Date.now(),
  };
  emit();
}

export function subscribeClockSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only: reset module state between vitest cases so a flaky sync in
 * one test doesn't leak into the next. Not exported from any barrel.
 */
export function __resetServerClockForTests(): void {
  snapshot = INITIAL_SNAPSHOT;
  listeners.clear();
}
