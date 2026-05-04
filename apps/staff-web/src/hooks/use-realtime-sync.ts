import { REFRESH_INTERVALS } from '@gustri/core';
import { REALTIME_INVALIDATE_DEBOUNCE_MS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

type RealtimeTable = {
  table: string;
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>;
  filter?: string;
};

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;

// Heartbeat watchdog: a channel can claim SUBSCRIBED but stop receiving
// messages (load balancer drops, NAT timeout, server restart). If we go
// 5 min without an event while supposedly subscribed, force a resubscribe.
const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_EVENT_THRESHOLD_MS = 5 * 60_000;

// Visibility-aware fallback cadence. Foreground tabs get a tighter poll so
// the kitchen doesn't sit on stale data; background tabs keep the original
// 2-min cadence to spare battery on tablets that get pocketed.
const FOREGROUND_FALLBACK_MS = 30_000;

/**
 * Subscribes to Supabase Realtime for a set of tables and
 * invalidates the corresponding React Query caches on changes.
 *
 * Uses a single multiplexed channel. Replaces per-page inline
 * useEffect subscriptions to eliminate duplicate connections.
 *
 * Includes:
 * - Exponential backoff reconnection on CHANNEL_ERROR / TIMED_OUT
 * - Safety-net fallback poll (120s) when WebSocket is not SUBSCRIBED
 * - Auth-aware resubscribe via `channelRegistry`. The realtime channel
 *   keeps the JWT it was opened with; without rebinding on TOKEN_REFRESHED
 *   the connection silently dies after ~55 min.
 *
 * Multi-tab safety: the supplied `channelName` is suffixed with a per-mount
 * UUID before being passed to `supabase.channel(...)` and registered. Two
 * tabs of the same user opening the same view (e.g. dashboard + kitchen)
 * therefore get distinct channel objects on the shared supabase client and
 * don't trample each other's subscriptions on unmount.
 */
export function useRealtimeSync(channelName: string, tables: RealtimeTable[]) {
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  // Keep tables in a ref so the channel doesn't re-subscribe on every render
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const subscribedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventAtRef = useRef<number | null>(null);
  // Stable per-mount unique channel id. `channelName` stays as the human
  // label; `uniqueChannelName` is what actually opens/registers the channel.
  const uniqueChannelNameRef = useRef<string | null>(null);
  if (uniqueChannelNameRef.current === null) {
    const suffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    uniqueChannelNameRef.current = `${channelName}:${suffix}`;
  }
  const uniqueChannelName = uniqueChannelNameRef.current;

  // Coalesce realtime-driven invalidations: bursts of events on the same
  // query key produce a single refetch on the trailing edge instead of one
  // refetch per event (5–10× reduction during dinner rush).
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      if (cancelledRef.current) return;
      for (const k of pendingKeysRef.current) {
        queryClient.invalidateQueries({ queryKey: JSON.parse(k) });
      }
      pendingKeysRef.current.clear();
    }, REALTIME_INVALIDATE_DEBOUNCE_MS);
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    for (const { queryKeys } of tablesRef.current) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient]);

  useEffect(() => {
    // Don't subscribe until we know the tenant
    if (!tenantId) return;

    cancelledRef.current = false;
    let currentChannel: RealtimeChannel | null = null;

    function createChannel(): RealtimeChannel {
      let channel = supabase.channel(uniqueChannelName);

      for (const { table, queryKeys, filter } of tablesRef.current) {
        // Use explicit filter if provided, otherwise scope by tenant_id
        const resolvedFilter = filter ?? `tenant_id=eq.${tenantId}`;
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: resolvedFilter },
          () => {
            // Guard: skip invalidation if component has unmounted
            if (cancelledRef.current) return;
            // Informational only — reconnect catch-up is driven by the
            // SUBSCRIBED-after-retry signal in the subscribe callback below.
            // Kept so we can wire per-table `since=` filtering once Supabase
            // Realtime exposes it.
            lastEventAtRef.current = Date.now();
            for (const key of queryKeys) {
              pendingKeysRef.current.add(JSON.stringify(key));
            }
            scheduleFlush();
          },
        );
      }

      channel.subscribe((status) => {
        if (cancelledRef.current) return;

        subscribedRef.current = status === 'SUBSCRIBED';

        if (status === 'SUBSCRIBED') {
          // Stamp the heartbeat baseline. Without this, the watchdog can't
          // distinguish "subscribed but server gone quiet" from "subscribed,
          // never seen any traffic" on a low-volume tenant.
          lastEventAtRef.current = Date.now();
          // Catch-up on reconnect: any postgres_changes events emitted while
          // the WS was down were dropped (Supabase Realtime has no replay).
          // After a successful resubscribe, refetch the affected query keys
          // so the UI is consistent with the DB. Only run on reconnect, not
          // the first SUBSCRIBED — avoids an extra fetch on every mount.
          const isReconnect = retryCountRef.current > 0;
          if (isReconnect) invalidateAll();
          retryCountRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          subscribedRef.current = false;
          supabase.removeChannel(channel);

          // Give up after too many retries — fallback polling will keep data fresh
          if (retryCountRef.current >= MAX_RETRIES) return;

          // Reconnect with exponential backoff
          const delay = Math.min(1000 * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) {
              currentChannel = createChannel();
            }
          }, delay);
        }
      });

      return channel;
    }

    currentChannel = createChannel();

    const forceResubscribe = () => {
      if (cancelledRef.current) return;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (currentChannel) supabase.removeChannel(currentChannel);
      retryCountRef.current = 0;
      subscribedRef.current = false;
      // Reset the heartbeat clock so the watchdog doesn't re-fire on the
      // freshly created channel before it's had a chance to receive anything.
      lastEventAtRef.current = Date.now();
      currentChannel = createChannel();
    };

    // Register with the auth-aware registry. On TOKEN_REFRESHED the bridge
    // calls resubscribe(), which tears down the stale-token channel and
    // recreates it so the new JWT is bound to the websocket frame.
    channelRegistry.register(uniqueChannelName, {
      resubscribe: forceResubscribe,
      teardown: () => {
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        subscribedRef.current = false;
      },
    });

    // Heartbeat watchdog: a channel can stay SUBSCRIBED locally while the
    // server stops delivering (LB drop, NAT timeout, partial outage). If we
    // haven't seen any event in 5 min while subscribed, force a resubscribe
    // so we re-bind the WS rather than waiting for an error event that
    // never comes.
    const heartbeatTimer = setInterval(() => {
      if (cancelledRef.current) return;
      if (!subscribedRef.current) return;
      const lastAt = lastEventAtRef.current;
      if (lastAt === null) return;
      if (Date.now() - lastAt > STALE_EVENT_THRESHOLD_MS) {
        forceResubscribe();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      subscribedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingKeysRef.current.clear();
      clearInterval(heartbeatTimer);
      channelRegistry.unregister(uniqueChannelName);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [uniqueChannelName, tenantId, scheduleFlush, invalidateAll]);

  // Safety-net fallback: poll when the WS is down. Foreground tabs get a
  // tighter cadence (30s) so the kitchen doesn't sit on stale data while a
  // human is watching; background tabs keep the original FALLBACK (120s)
  // to spare tablet battery.
  useEffect(() => {
    if (typeof document === 'undefined') {
      const interval = setInterval(() => {
        if (!subscribedRef.current) invalidateAll();
      }, REFRESH_INTERVALS.FALLBACK);
      return () => clearInterval(interval);
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) clearInterval(timer);
      const delay = document.hidden ? REFRESH_INTERVALS.FALLBACK : FOREGROUND_FALLBACK_MS;
      timer = setInterval(() => {
        if (!subscribedRef.current) invalidateAll();
      }, delay);
    };

    const onVisibilityChange = () => start();

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timer !== null) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [invalidateAll]);

  return { lastEventAtRef };
}
