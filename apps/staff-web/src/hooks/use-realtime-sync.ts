import { REFRESH_INTERVALS } from '@gustri/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type RealtimeTable = {
  table: string;
  queryKeys: string[][];
};

/**
 * Subscribes to Supabase Realtime for a set of tables and
 * invalidates the corresponding React Query caches on changes.
 *
 * Uses a single multiplexed channel. Replaces per-page inline
 * useEffect subscriptions to eliminate duplicate connections.
 *
 * Includes a safety-net fallback poll (120s) that activates only
 * when the WebSocket is not in SUBSCRIBED state, catching silent
 * disconnects without adding load during normal operation.
 */
export function useRealtimeSync(channelName: string, tables: RealtimeTable[]) {
  const queryClient = useQueryClient();
  // Keep tables in a ref so the channel doesn't re-subscribe on every render
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const subscribedRef = useRef(false);

  const invalidateAll = useCallback(() => {
    for (const { queryKeys } of tablesRef.current) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient]);

  useEffect(() => {
    let channel = supabase.channel(channelName);

    for (const { table, queryKeys } of tablesRef.current) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      });
    }

    channel.subscribe((status) => {
      subscribedRef.current = status === 'SUBSCRIBED';
    });

    return () => {
      subscribedRef.current = false;
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
