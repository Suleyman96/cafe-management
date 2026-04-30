import { REFRESH_INTERVALS } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { type RealtimeChannelStatus, useRealtimeStatusStore } from '@/store/realtime-status-store';

export type RealtimeHandler<TPayload = Record<string, unknown>> = {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  queryKeys: string[][];
  /** Optional callback for side effects (sound, notifications). Runs before invalidation. */
  onPayload?: (payload: TPayload) => void | Promise<void>;
};

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;
/**
 * Health-check window after AppState resume. If a freshly recreated channel
 * hasn't reached SUBSCRIBED within this many ms, we re-invalidate and retry —
 * a stalled `JOINING` looks healthy to the hook but yields no events.
 */
const POST_RESUME_HEALTH_CHECK_MS = 3_000;

/**
 * Detach a channel from the websocket multiplex and drop it from the client
 * registry. We call `unsubscribe()` explicitly before `removeChannel()` so the
 * channel's local state is torn down synchronously — important when a retry or
 * AppState foreground swaps in a fresh channel under the same name immediately
 * after. Without the explicit unsubscribe, in-flight leave promises and the
 * new channel can briefly coexist on flaky networks (a real concern on staff
 * tablets that bounce in and out of coverage all shift).
 */
async function teardownChannel(channel: RealtimeChannel): Promise<void> {
  try {
    await channel.unsubscribe();
  } catch {
    // Already unsubscribed or never subscribed — proceed to removeChannel.
  }
  try {
    await supabase.removeChannel(channel);
  } catch {
    // Channel was already evicted from the registry — nothing to do.
  }
}

/**
 * Subscribes to Supabase Realtime for a set of table events and
 * invalidates the corresponding React Query caches on changes.
 *
 * Uses a single multiplexed channel per channelName. Includes:
 * - Exponential backoff reconnection on CHANNEL_ERROR / TIMED_OUT
 * - Two-speed safety-net poll: slow `FALLBACK` while the WS is briefly down,
 *   fast `DEGRADED_FALLBACK` once the channel exhausts its retry budget so
 *   the UI catches up within ~20s instead of ~2min during service.
 * - Sentry breadcrumb on every status transition for post-incident triage
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
  // Last status emitted to the store — drives the Sentry breadcrumb and the
  // poll-cadence selector below. We track it in a ref (not state) because the
  // safety-net interval reads it on every tick and we don't want to re-create
  // the interval on every transition.
  const statusRef = useRef<RealtimeChannelStatus | null>(null);
  const lastEventAtRef = useRef<number | null>(null);

  const invalidateAll = useCallback(() => {
    for (const { queryKeys } of handlersRef.current) {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [queryClient]);

  const transitionStatus = useCallback(
    (next: RealtimeChannelStatus) => {
      const prev = statusRef.current;
      if (prev === next) return;
      statusRef.current = next;
      useRealtimeStatusStore.getState().setChannelStatus(channelName, next);
      Sentry.addBreadcrumb({
        category: 'realtime',
        message: `channel "${channelName}" ${prev ?? 'init'} → ${next}`,
        level: next === 'degraded' ? 'warning' : 'info',
        data: {
          channelName,
          fromStatus: prev,
          toStatus: next,
          retryCount: retryCountRef.current,
          lastEventAt: lastEventAtRef.current,
        },
      });
    },
    [channelName],
  );

  useEffect(() => {
    if (!tenantId) return;

    cancelledRef.current = false;
    let currentChannel: RealtimeChannel | null = null;
    let postResumeHealthTimer: ReturnType<typeof setTimeout> | null = null;

    function createChannel(): RealtimeChannel {
      const tenantFilter = `tenant_id=eq.${tenantId}`;
      let channel = supabase.channel(channelName);

      for (const { table, event, queryKeys, onPayload } of handlersRef.current) {
        channel = channel.on(
          'postgres_changes',
          { event, schema: 'public', table, filter: tenantFilter },
          async (payload) => {
            if (cancelledRef.current) return;

            lastEventAtRef.current = Date.now();

            if (onPayload) {
              try {
                await onPayload(payload.new as Record<string, unknown>);
              } catch (err: unknown) {
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
          transitionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          subscribedRef.current = false;
          void teardownChannel(channel);

          if (retryCountRef.current >= MAX_RETRIES) {
            // Exhausted retries — flip to degraded, immediately invalidate so
            // anything inserted during the gap shows up, and the fast 20s
            // safety-net poll below will keep refreshing until we recover.
            transitionStatus('degraded');
            invalidateAll();
            Sentry.captureMessage(`Realtime channel "${channelName}" exhausted retries`, {
              level: 'warning',
              extra: { tenantId },
            });
            return;
          }

          transitionStatus('reconnecting');
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

    currentChannel = createChannel();

    // Reconnect on app foreground: the OS often kills WebSocket connections
    // while the app is backgrounded without firing a CHANNEL_ERROR or TIMED_OUT
    // event, so the existing backoff path never triggers. Without this listener,
    // a phone in a waiter's pocket comes back to a silent realtime channel and
    // misses incoming orders until the safety-net poll catches up.
    let lastAppState = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (next) => {
      const wasInactive = lastAppState !== 'active';
      lastAppState = next;
      if (!wasInactive || next !== 'active' || cancelledRef.current) return;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // Tearing down the prior channel can throw on a half-dead socket; never
      // let that block recreation. Errors here are best-effort cleanup —
      // breadcrumb them so we still have visibility.
      if (currentChannel) {
        try {
          void teardownChannel(currentChannel);
        } catch (err) {
          Sentry.addBreadcrumb({
            category: 'realtime',
            message: `teardown threw on resume for "${channelName}" — proceeding`,
            level: 'warning',
            data: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
      retryCountRef.current = 0;
      currentChannel = createChannel();

      // Always invalidate once on resume — one extra fetch per channel is
      // cheap insurance against an event that arrived during the background
      // window but never made it to the cache.
      invalidateAll();

      // Post-resume health check: if the new subscribe stalls in JOINING,
      // the hook believes itself healthy but receives no events. Re-invalidate
      // and re-create the channel so the user isn't held hostage to a stuck
      // join handshake.
      if (postResumeHealthTimer) clearTimeout(postResumeHealthTimer);
      postResumeHealthTimer = setTimeout(() => {
        if (cancelledRef.current) return;
        if (subscribedRef.current) return;
        Sentry.addBreadcrumb({
          category: 'realtime',
          message: `post-resume health check failed for "${channelName}" — reattempting`,
          level: 'warning',
          data: { channelName },
        });
        invalidateAll();
        if (currentChannel) {
          try {
            void teardownChannel(currentChannel);
          } catch {
            // Best-effort
          }
        }
        currentChannel = createChannel();
      }, POST_RESUME_HEALTH_CHECK_MS);
    });

    return () => {
      cancelledRef.current = true;
      subscribedRef.current = false;
      appStateSub.remove();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (postResumeHealthTimer) clearTimeout(postResumeHealthTimer);
      if (currentChannel) void teardownChannel(currentChannel);
      useRealtimeStatusStore.getState().removeChannel(channelName);
      statusRef.current = null;
    };
  }, [channelName, tenantId, queryClient, invalidateAll, transitionStatus]);

  // Two-speed safety-net poll. We restart the interval whenever the cadence
  // needs to change — every realtime status transition writes to the status
  // store, so a subscription to it gives us reactive cadence. Reading
  // `statusRef` inside the tick keeps us robust even if React batches stale.
  const channelStatus = useRealtimeStatusStore((s) => s.channels[channelName] ?? null);

  useEffect(() => {
    const intervalMs =
      channelStatus === 'degraded'
        ? REFRESH_INTERVALS.DEGRADED_FALLBACK
        : REFRESH_INTERVALS.FALLBACK;

    const interval = setInterval(() => {
      if (!subscribedRef.current) {
        invalidateAll();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [channelStatus, invalidateAll]);
}
