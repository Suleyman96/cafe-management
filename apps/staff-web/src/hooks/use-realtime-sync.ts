import { REFRESH_INTERVALS } from '@gustri/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type RealtimeTable = {
  table: string;
  queryKeys: string[][];
};

const MAX_BACKOFF_MS = 30_000;

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
 */
export function useRealtimeSync(channelName: string, tables: RealtimeTable[]) {
  const queryClient = useQueryClient();
  // Keep tables in a ref so the channel doesn't re-subscribe on every render
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const subscribedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidateAll = useCallback(() => {
    for (const { queryKeys } of tablesRef.current) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    function createChannel() {
      let channel = supabase.channel(channelName);

      for (const { table, queryKeys } of tablesRef.current) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        });
      }

      channel.subscribe((status) => {
        if (cancelled) return;

        subscribedRef.current = status === 'SUBSCRIBED';

        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          subscribedRef.current = false;
          supabase.removeChannel(channel);

          // Reconnect with exponential backoff
          const delay = Math.min(1000 * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelled) createChannel();
          }, delay);
        }
      });

      return channel;
    }

    const channel = createChannel();

    return () => {
      cancelled = true;
      subscribedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelName, queryClient]);

  // Safety-net fallback: poll at a long interval when the WS may be down
  useEffect(() => {
    const interval = setInterval(() => {
      if (!subscribedRef.current) {
        invalidateAll();
      }
    }, REFRESH_INTERVALS.FALLBACK);

    return () => clearInterval(interval);
  }, [invalidateAll]);
}
