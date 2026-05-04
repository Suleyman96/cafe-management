'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { channelRegistry } from '@/lib/realtime/channel-registry';

/**
 * Resubscribes Realtime channels and refetches all React Query caches when
 * the tab wakes from background sleep or the network comes back online.
 *
 * Without this, a tablet whose tab was backgrounded for >55 min wakes up
 * with a dead websocket (the JWT it opened with has expired and Supabase
 * Realtime never re-auths) AND stale query data. The user sees ~2 minutes
 * of nothing until the safety-net `REFRESH_INTERVALS.FALLBACK` poll fires.
 *
 * Throttle: tablet farms blip together when wifi flaps, so coalesce
 * multiple events within a 2s window into a single wake.
 *
 * Jitter: across 50 tablets, a synchronized refetch on `online` would
 * create a thundering-herd against PostgREST. Spread the resubscribe over
 * a 0–500ms window so the fanout is uncorrelated.
 */

const WAKE_THROTTLE_MS = 2_000;
const WAKE_JITTER_MAX_MS = 500;

export function LifecycleBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    let lastWakeAt = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const onWake = () => {
      const now = Date.now();
      if (now - lastWakeAt < WAKE_THROTTLE_MS) return;
      if (pendingTimer !== null) return;

      const jitter = Math.random() * WAKE_JITTER_MAX_MS;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        lastWakeAt = Date.now();
        channelRegistry.resubscribeAll();
        queryClient.invalidateQueries();
      }, jitter);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onWake();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onWake);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onWake);
      if (pendingTimer !== null) clearTimeout(pendingTimer);
    };
  }, [queryClient]);

  return null;
}
