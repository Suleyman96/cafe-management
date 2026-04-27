import { REFRESH_INTERVALS } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

type RealtimeHandler = {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  queryKeys: string[][];
  /** Optional callback for side effects (sound, notifications). Runs before invalidation. */
  onPayload?: (payload: Record<string, unknown>) => void | Promise<void>;
};

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;

/**
 * Subscribes to Supabase Realtime for a set of table events and
 * invalidates the corresponding React Query caches on changes.
 *
 * Uses a single multiplexed channel per channelName. Includes:
 * - Exponential backoff reconnection on CHANNEL_ERROR / TIMED_OUT
 * - Safety-net fallback poll when WebSocket is not SUBSCRIBED
 * - Sentry reporting for persistent failures
 */
export function useRealtimeSync(channelName: string, handlers: RealtimeHandler[]) {
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const subscribedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const invalidateAll = useCallback(() => {
    for (const { queryKeys } of handlersRef.current) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient]);

  useEffect(() => {
    if (!tenantId) return;

    cancelledRef.current = false;
    let currentChannel: RealtimeChannel;

    function createChannel() {
      const tenantFilter = `tenant_id=eq.${tenantId}`;
      let channel = supabase.channel(channelName);

      for (const { table, event, queryKeys, onPayload } of handlersRef.current) {
        channel = channel.on(
          'postgres_changes',
          { event, schema: 'public', table, filter: tenantFilter },
          async (payload) => {
            if (cancelledRef.current) return;

            if (onPayload) {
              try {
                await onPayload(payload.new as Record<string, unknown>);
              } catch (err) {
                // Side effect failed — report and still invalidate below.
                // Without this we lose visibility into broken sound/notification handlers.
                Sentry.captureException(err, {
                  tags: { area: 'realtime', channelName, table, event: String(event) },
                });
              }
            }

            for (const key of queryKeys) {
              queryClient.invalidateQueries({ queryKey: key });
            }
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

          if (retryCountRef.current >= MAX_RETRIES) {
            Sentry.captureMessage(`Realtime channel "${channelName}" exhausted retries`, {
              level: 'warning',
              extra: { tenantId },
            });
            return;
          }

          const delay = Math.min(1000 * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) {
              currentChannel = createChannel();
            }
          }, delay);
        }
      });

      currentChannel = channel;
      return channel;
    }

    createChannel();

    return () => {
      cancelledRef.current = true;
      subscribedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [channelName, tenantId, queryClient]);

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
