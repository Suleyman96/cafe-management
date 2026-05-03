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
  queryKeys: string[][];
  filter?: string;
};

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;

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
      let channel = supabase.channel(channelName);

      for (const { table, queryKeys, filter } of tablesRef.current) {
        // Use explicit filter if provided, otherwise scope by tenant_id
        const resolvedFilter = filter ?? `tenant_id=eq.${tenantId}`;
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: resolvedFilter },
          () => {
            // Guard: skip invalidation if component has unmounted
            if (cancelledRef.current) return;
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

    // Register with the auth-aware registry. On TOKEN_REFRESHED the bridge
    // calls resubscribe(), which tears down the stale-token channel and
    // recreates it so the new JWT is bound to the websocket frame.
    channelRegistry.register(channelName, {
      resubscribe: () => {
        if (cancelledRef.current) return;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        if (currentChannel) supabase.removeChannel(currentChannel);
        retryCountRef.current = 0;
        subscribedRef.current = false;
        currentChannel = createChannel();
      },
      teardown: () => {
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        subscribedRef.current = false;
      },
    });

    return () => {
      cancelledRef.current = true;
      subscribedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingKeysRef.current.clear();
      channelRegistry.unregister(channelName);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [channelName, tenantId, scheduleFlush]);

  // Safety-net fallback: poll at a long interval when the WS may be down
  useEffect(() => {
    const interval = setInterval(() => {
      if (!subscribedRef.current) {
        invalidateAll();
      }
    }, REFRESH_INTERVALS.FALLBACK);

    return () => clearInterval(interval);
  }, [invalidateAll]);

  return { lastEventAtRef };
}
