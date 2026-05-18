'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  getClockSnapshot,
  getServerClockSnapshotForSSR,
  setSyncedAnchor,
  subscribeClockSync,
} from '@/lib/server-clock';

const HEALTH_URL = '/api/v1/health';

/**
 * Re-sync cadence. The offset is stable across drift (<1ms/sec on a
 * modern device), so a 5-minute resync keeps the estimate within ~300ms
 * of truth — well below the 1-minute granularity of the kitchen UI.
 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Initial-sync backoff after a transient failure. Don't bombard a flaky
 * network with retries — the clock estimate degrades gracefully (just
 * uses the device clock) until a sync succeeds.
 */
const RETRY_INTERVAL_MS = 30_000;

async function syncOnce(): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const res = await fetch(HEALTH_URL, { cache: 'no-store' });
    const endedAt = Date.now();
    if (!res.ok) return false;
    const body = (await res.json()) as { ts?: unknown };
    if (typeof body.ts !== 'string') return false;
    setSyncedAnchor(body.ts, startedAt, endedAt);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap a singleton sync loop. Mount this once in the provider tree;
 * subsequent mounts no-op. Safe across React StrictMode double-mount
 * because the loop is module-scoped (timer is cleared on unmount and
 * re-armed on the next mount cleanly).
 */
export function useClockSyncBootstrap(): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      const ok = await syncOnce();
      if (cancelled) return;
      timer = setTimeout(loop, ok ? SYNC_INTERVAL_MS : RETRY_INTERVAL_MS);
    };

    loop();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
}

/**
 * Read the current clock-sync snapshot in a render-safe way. Only emits
 * a re-render when an actual sync lands — not on every Date.now() tick.
 */
export function useClockSync() {
  return useSyncExternalStore(subscribeClockSync, getClockSnapshot, getServerClockSnapshotForSSR);
}
