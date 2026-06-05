'use client';

import type { Database } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { useDb } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useIsLeaderTab } from '@/hooks/use-is-leader-tab';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

export type AudioChannel = 'orders' | 'waiterCalls' | 'alerts';
export type AudioPrefs = Record<AudioChannel, boolean>;

interface AudioPrefsContextValue {
  prefs: AudioPrefs;
  toggleChannel: (channel: AudioChannel) => void;
}

const AudioPrefsContext = createContext<AudioPrefsContextValue | null>(null);

export function useAudioPrefs(): AudioPrefsContextValue {
  const ctx = useContext(AudioPrefsContext);
  if (!ctx) {
    throw new Error('useAudioPrefs must be used within a NotificationProvider');
  }
  return ctx;
}

type OrderRow = Database['public']['Tables']['orders']['Row'];

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;
const POLL_INTERVAL_MS = 120_000; // 2 minutes — matches REFRESH_INTERVALS.FALLBACK
// Watchdog for the initial .subscribe() handshake. Supabase emits
// `SUBSCRIBED` on success and `TIMED_OUT` on its own internal timeout,
// but a failed WS upgrade (stale JWT rejected at handshake, proxy that
// strips the auth header) can leave the .subscribe() callback silent
// indefinitely — neither status fires. Without this watchdog the channel
// sits dead until the next visibilitychange / online event nudges it,
// which on a kiosk tablet can be hours. 10s is generous vs. a healthy
// subscribe (<1s) but short enough that polling fallback isn't the
// recovery mechanism of last resort.
const SUBSCRIBE_TIMEOUT_MS = 10_000;
// Catchup window overlap: a few seconds before `lastEventAt` to absorb clock
// skew between client and server. Without it, an event whose server-side
// timestamp lands one millisecond before lastEventAt would be skipped.
const CATCHUP_OVERLAP_MS = 5_000;
// Cap the catchup result set so a long disconnect can't flood the client
// with thousands of rows. The cache will still converge via the next
// fallback poll / manual refresh; we just don't audio-alert past this.
const CATCHUP_LIMIT = 200;

const DEFAULT_AUDIO_PREFS: AudioPrefs = { orders: true, waiterCalls: true, alerts: true };
const LEGACY_AUDIO_KEY = 'staff-audio-enabled';

function audioPrefsStorageKey(staffId: string | undefined): string {
  // Per-staff key so a kiosk shared by multiple staff each remembers its own
  // mute preferences. Falls back to a device-global key when no staff is
  // bound (pre-auth boot) — that branch only writes defaults so it can't
  // leak one user's choices into another's slot.
  return staffId ? `staff-audio-prefs:${staffId}` : 'staff-audio-prefs';
}

function readStoredAudioPrefs(staffId: string | undefined): AudioPrefs {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_PREFS;
  try {
    const raw = localStorage.getItem(audioPrefsStorageKey(staffId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        orders: typeof parsed.orders === 'boolean' ? parsed.orders : DEFAULT_AUDIO_PREFS.orders,
        waiterCalls:
          typeof parsed.waiterCalls === 'boolean'
            ? parsed.waiterCalls
            : DEFAULT_AUDIO_PREFS.waiterCalls,
        alerts: typeof parsed.alerts === 'boolean' ? parsed.alerts : DEFAULT_AUDIO_PREFS.alerts,
      };
    }
    // Migration from the pre-split single global toggle: a `false` legacy
    // value silenced everything, so honor that across all three channels.
    const legacy = localStorage.getItem(LEGACY_AUDIO_KEY);
    if (legacy !== null) {
      const enabled = legacy === 'true';
      return { orders: enabled, waiterCalls: enabled, alerts: enabled };
    }
  } catch {
    // Corrupted JSON or storage disabled — fall through to defaults.
  }
  return DEFAULT_AUDIO_PREFS;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('staff');
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  const staffId = useAuthStore((s) => s.staff?.id);
  const db = useDb();
  // Audio leader: among all open tabs of this staff session, exactly one
  // plays sound. Visual toasts continue per-tab. The hook returns false
  // until the election resolves (typically synchronous via Web Locks; up
  // to ~2s on the BroadcastChannel fallback). We treat "not leader yet"
  // as "don't play" — false-quiet is safer than false-buzz.
  const isLeader = useIsLeaderTab();
  const isLeaderRef = useRef(isLeader);
  isLeaderRef.current = isLeader;
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);

  const waiterCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const orderAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioPrefsRef = useRef<AudioPrefs>(audioPrefs);
  const audioUnlockedRef = useRef(false);
  // Queue: store pending sound to play once unlocked (channel keeps the gate
  // intact when the unlock finally happens — a queued waiter-call cue must
  // not slip through if waiter-calls were muted in the meantime).
  const pendingSoundRef = useRef<{ channel: AudioChannel; audio: HTMLAudioElement } | null>(null);

  // Retry + connection state for realtime subscriptions
  const retryCountRef = useRef(0);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // --- Catchup state (Plan 10) ---
  // `lastEventAt` is the high-water mark for "last realtime event observed
  // by this tab". On a successful resubscribe after a drop, we fetch all
  // rows changed since (lastEventAt - overlap) and re-fire deduplicated
  // audio + a catchup toast for genuinely-new rows.
  const lastEventAtRef = useRef<number>(Date.now());
  // Session start anchor: a row whose `created_at` predates this is not
  // "genuinely new" from the user's perspective — they already saw it on
  // mount via the initial fetch.
  const sessionStartedAtRef = useRef<number>(Date.now());
  // Per-session audio-alert dedupe sets. Without this, a row that the live
  // INSERT path already buzzed about would buzz again from the catchup
  // path on every reconnect.
  const alertedOrderIdsRef = useRef<Set<string>>(new Set());
  const alertedWaiterCallIdsRef = useRef<Set<string>>(new Set());

  // Reset session anchors when the bound tenant changes (sign-out → sign-in
  // as a different user / cafe). Without this, dedupe sets would persist
  // across sessions and a freshly-signed-in user would miss alerts they
  // never previously heard. tenantId is the trigger, not used inside.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tenantId change is the trigger
  useEffect(() => {
    sessionStartedAtRef.current = Date.now();
    lastEventAtRef.current = Date.now();
    alertedOrderIdsRef.current.clear();
    alertedWaiterCallIdsRef.current.clear();
  }, [tenantId]);

  // Load stored prefs whenever the bound staff changes (sign-in, switch
  // user). Reading lazily inside an effect (rather than the useState
  // initializer) keeps the initial render SSR-safe and lets a logout →
  // login as a different user pull that user's saved choices.
  useEffect(() => {
    setAudioPrefs(readStoredAudioPrefs(staffId));
  }, [staffId]);

  // Keep ref in sync so the realtime callbacks (which read via ref to
  // avoid tearing down the WS on every state change) see fresh prefs.
  useEffect(() => {
    audioPrefsRef.current = audioPrefs;
  }, [audioPrefs]);

  // Create audio elements
  useEffect(() => {
    if (typeof window !== 'undefined') {
      waiterCallAudioRef.current = new Audio('/waiter-call.mp3');
      waiterCallAudioRef.current.preload = 'auto';

      orderAudioRef.current = new Audio('/order-notification.mp3');
      orderAudioRef.current.preload = 'auto';

      notificationAudioRef.current = new Audio('/notification.mp3');
      notificationAudioRef.current.preload = 'auto';
    }
  }, []);

  // Save prefs whenever they change. Skip the very first run on mount —
  // the load effect above just hydrated state from storage, so writing it
  // back would be a no-op at best and an overwrite-with-defaults race at
  // worst (load effect hasn't completed before this one runs).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(audioPrefsStorageKey(staffId), JSON.stringify(audioPrefs));
    } catch {
      // Storage quota exceeded or disabled — silently drop, the in-memory
      // state still works for the session.
    }
  }, [audioPrefs, staffId]);

  // Auto-unlock audio on ANY user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;

      // Unlock all audio elements with silent play
      const allAudios = [
        waiterCallAudioRef.current,
        orderAudioRef.current,
        notificationAudioRef.current,
      ];
      const unlockPromises = allAudios.map((audio) => {
        if (!audio) return Promise.resolve();
        audio.volume = 0;
        return audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
          })
          .catch(() => {});
      });

      // After all unlocked, play any pending sound
      Promise.all(unlockPromises).then(() => {
        audioUnlockedRef.current = true;

        // Play the queued sound if there is one — re-check the channel
        // gate in case the user muted the channel between queue and unlock.
        const pending = pendingSoundRef.current;
        if (pending && audioPrefsRef.current[pending.channel]) {
          pending.audio.volume = 1;
          pending.audio.currentTime = 0;
          pending.audio.play().catch(() => {});
        }
        pendingSoundRef.current = null;
      });

      // Remove listeners after first interaction
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Play sound helper — gated by per-channel mute (Plan 15) and leader
  // election (Plan 9). Non-leader tabs skip the play entirely so two open
  // tabs of the same staff session don't double-buzz on every realtime event.
  const playSound = useCallback((channel: AudioChannel, audio: HTMLAudioElement | null) => {
    if (!audio) return;
    if (!audioPrefsRef.current[channel]) return;
    if (!isLeaderRef.current) return;

    if (!audioUnlockedRef.current) {
      // Audio not unlocked yet - queue it for when user interacts
      pendingSoundRef.current = { channel, audio };
      return;
    }

    audio.currentTime = 0;
    audio.play().catch((err) => {
      Sentry.addBreadcrumb({
        category: 'audio',
        message: 'Audio play failed',
        level: 'warning',
        data: { error: err.message, channel },
      });
    });
  }, []);

  // Toggle a single channel. Updating the ref synchronously (in addition
  // to setState) means a play() fired on the same tick as the toggle
  // already sees the new value, instead of using the previous render's
  // snapshot. The persistence effect picks up the state change separately.
  const toggleChannel = useCallback(
    (channel: AudioChannel) => {
      const wasEnabled = audioPrefsRef.current[channel];
      const next: AudioPrefs = { ...audioPrefsRef.current, [channel]: !wasEnabled };
      audioPrefsRef.current = next;
      setAudioPrefs(next);

      // Turning ON: play a confirmation sound (also acts as the autoplay
      // unlock for this channel). On failure, surface the existing
      // "click again" guidance toast — same UX as the pre-split toggle.
      if (!wasEnabled) {
        const audio =
          channel === 'orders'
            ? orderAudioRef.current
            : channel === 'waiterCalls'
              ? waiterCallAudioRef.current
              : notificationAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio
            .play()
            .then(() => {
              audioUnlockedRef.current = true;
            })
            .catch((err) => {
              Sentry.addBreadcrumb({
                category: 'audio',
                message: 'Audio play failed on toggle',
                level: 'warning',
                data: { error: err.message, channel },
              });
              toast.error(t('notifications.enableFailed'));
            });
        }
      }
    },
    [t],
  );

  // Run the realtime catchup query after a successful resubscribe (Plan 10).
  // Supabase Realtime has no replay buffer, so events emitted during a
  // disconnect are lost. We compensate by fetching all rows changed since
  // `lastEventAt - 5s` and re-firing deduplicated audio for genuinely-new
  // orders + waiter calls.
  //
  // Identity is intentionally NOT memoized via deps — the channel-setup
  // effect mounts the realtime channel only when `tenantId` changes, and
  // we hold this callable behind a ref so re-renders driven by unrelated
  // state (leader election, t() identity churn) don't tear down the WS.
  const runCatchup = useCallback(async () => {
    if (!tenantId) return;
    const since = new Date(lastEventAtRef.current - CATCHUP_OVERLAP_MS);
    try {
      const [orders, waiterCalls] = await Promise.all([
        db.orders.findChangedSince(since, { limit: CATCHUP_LIMIT }),
        db.waiterCalls.findCreatedSince(since, { limit: CATCHUP_LIMIT }),
      ]);

      // Genuinely-new orders: status pending_approval / new, created during
      // this session, and not yet audio-alerted. The created_at gate keeps
      // the initial fetch on mount from triggering a phantom catchup.
      const newOrders = orders.filter((o) => {
        const created = o.created_at ? Date.parse(o.created_at) : 0;
        return (
          (o.status === 'pending_approval' || o.status === 'new') &&
          created >= sessionStartedAtRef.current &&
          !alertedOrderIdsRef.current.has(o.id)
        );
      });
      const newWaiterCalls = waiterCalls.filter((c) => {
        const created = c.created_at ? Date.parse(c.created_at) : 0;
        return (
          c.status === 'pending' &&
          created >= sessionStartedAtRef.current &&
          !alertedWaiterCallIdsRef.current.has(c.id)
        );
      });

      // Mark everything we're about to surface so the live INSERT path (if
      // a delayed event finally arrives after we've already alerted) doesn't
      // double-fire.
      for (const o of newOrders) alertedOrderIdsRef.current.add(o.id);
      for (const c of newWaiterCalls) alertedWaiterCallIdsRef.current.add(c.id);

      // One audio cue total (regardless of count) so a 50-row catchup
      // doesn't machine-gun the kitchen. Catchup is classified as an
      // 'alerts' channel event — it's a system-level reconnect signal,
      // not a per-event ping, so muting the alerts channel silences it
      // even if orders/waiter-calls are still on.
      if (newOrders.length > 0 || newWaiterCalls.length > 0) {
        playSound('alerts', notificationAudioRef.current);
      }
      if (newOrders.length > 0) {
        toast.info(t('notifications.catchupOrders', { count: newOrders.length }), {
          duration: 6000,
        });
      }
      if (newWaiterCalls.length > 0) {
        toast.info(t('notifications.catchupWaiterCalls', { count: newWaiterCalls.length }), {
          duration: 6000,
        });
      }
      // If the cap was hit, surface a hint that something was truncated —
      // realtime invalidations and the fallback poll will still catch up
      // the cache, but the user should know audio coverage isn't complete.
      if (orders.length >= CATCHUP_LIMIT || waiterCalls.length >= CATCHUP_LIMIT) {
        toast.warning(t('notifications.catchupTruncated'), { duration: 8000 });
      }

      // Advance the high-water mark so a subsequent reconnect doesn't
      // re-process the same window.
      lastEventAtRef.current = Date.now();
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'realtime-catchup' } });
    }
  }, [db, tenantId, t, playSound]);

  // Stable ref to the latest runCatchup. The channel-setup effect should
  // only re-run when `tenantId` changes — pulling runCatchup out of its deps
  // (and reading via this ref) prevents unrelated re-renders from tearing
  // down and recreating the WS subscription.
  const runCatchupRef = useRef(runCatchup);
  runCatchupRef.current = runCatchup;
  // Same trick for `t` and `playSound`: their identity may change across
  // renders (i18next mock returns a fresh `t` per render) but their *behavior*
  // is stable. Reading via ref keeps the channel-setup effect's deps tight.
  const tRef = useRef(t);
  tRef.current = t;
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  // Consolidated realtime subscription with retry + exponential backoff.
  //
  // Registers with `channelRegistry` so the global RealtimeAuthBridge can
  // resubscribe this channel on TOKEN_REFRESHED. Without that, the websocket
  // keeps the JWT it was opened with, the connection silently dies after
  // ~55 min, and the staff kitchen view stops receiving new-order /
  // waiter-call alerts (the 120s safety poll keeps data fresh, but audio
  // alerts and the immediacy contract degrade silently).
  //
  // The registry key is also UUID-suffixed so two tabs of the same user
  // (e.g. dashboard + kitchen) don't trample each other's entries — same
  // multi-tab safety pattern as `useRealtimeSync`.
  useEffect(() => {
    if (!tenantId) return;

    const suffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const registryKey = `notify-all:${suffix}`;

    let currentChannel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let subscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function scheduleRetry(
      channel: RealtimeChannel,
      reason: 'channel_error' | 'subscribe_timeout',
    ) {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
      if (currentChannel === channel) currentChannel = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        Sentry.captureMessage(
          `Notification realtime: max retries exceeded (${reason}), falling back to polling`,
          'warning',
        );
        return;
      }

      const delay = Math.min(1000 * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
      retryCountRef.current++;
      retryTimer = setTimeout(() => {
        setupChannel();
      }, delay);
    }

    function setupChannel() {
      if (cancelled) return;
      if (subscribeTimer) {
        clearTimeout(subscribeTimer);
        subscribeTimer = null;
      }
      Sentry.addBreadcrumb({ category: 'realtime', message: 'Setting up notifications channel' });

      const channel = supabase
        .channel(registryKey)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'waiter_calls',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            Sentry.addBreadcrumb({
              category: 'realtime',
              message: `waiter_calls ${payload.eventType}`,
            });
            lastEventAtRef.current = Date.now();
            if (payload.eventType === 'INSERT') {
              const newCall = payload.new as { id?: string };
              // Dedupe against catchup: a delayed INSERT for a row we
              // already audio-alerted via catchup must not buzz again.
              if (newCall.id && alertedWaiterCallIdsRef.current.has(newCall.id)) return;
              if (newCall.id) alertedWaiterCallIdsRef.current.add(newCall.id);
              playSoundRef.current('waiterCalls', waiterCallAudioRef.current);
              toast.info(tRef.current('notifications.newStaffCall'), {
                description: tRef.current('notifications.tableNeedsAssistance'),
                duration: 5000,
              });
            }
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
          (payload) => {
            Sentry.addBreadcrumb({ category: 'realtime', message: `orders ${payload.eventType}` });
            lastEventAtRef.current = Date.now();
            if (payload.eventType === 'INSERT') {
              const newOrder = payload.new as OrderRow;
              if (newOrder.id && alertedOrderIdsRef.current.has(newOrder.id)) return;
              if (newOrder.id) alertedOrderIdsRef.current.add(newOrder.id);
              if (newOrder.status === 'pending_approval') {
                playSoundRef.current('orders', notificationAudioRef.current);
                toast.info(tRef.current('notifications.newQrOrder'), {
                  description: tRef.current('notifications.qrOrderDescription'),
                  duration: 5000,
                });
              } else {
                playSoundRef.current('orders', orderAudioRef.current);
                toast.info(tRef.current('notifications.newOrder'), {
                  description: tRef.current('notifications.newOrderDescription'),
                  duration: 3000,
                });
              }
            }
            if (payload.eventType === 'UPDATE') {
              const newOrder = payload.new as OrderRow;
              const oldOrder = payload.old as Partial<OrderRow>;
              if (newOrder.status === 'ready' && oldOrder.status !== 'ready') {
                Sentry.addBreadcrumb({ category: 'realtime', message: 'Order ready notification' });
                playSoundRef.current('orders', notificationAudioRef.current);
                toast.success(tRef.current('notifications.orderReady'), {
                  description: tRef.current('notifications.orderReadyDescription'),
                  duration: 5000,
                });
              }
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_items',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            Sentry.addBreadcrumb({
              category: 'realtime',
              message: `order_items ${payload.eventType}`,
            });
            lastEventAtRef.current = Date.now();
            if (payload.eventType === 'INSERT') {
              playSoundRef.current('orders', orderAudioRef.current);
              toast.info(tRef.current('notifications.newItemsAdded'), {
                description: tRef.current('notifications.itemsAddedDescription'),
                duration: 3000,
              });
            }
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          // Any status callback means the channel is alive enough for
          // Supabase to talk back — clear the handshake watchdog whether
          // the news is good (SUBSCRIBED) or bad (CHANNEL_ERROR/TIMED_OUT).
          if (subscribeTimer) {
            clearTimeout(subscribeTimer);
            subscribeTimer = null;
          }
          Sentry.addBreadcrumb({
            category: 'realtime',
            message: `notifications channel: ${status}`,
          });

          if (status === 'SUBSCRIBED') {
            const isReconnect = retryCountRef.current > 0;
            retryCountRef.current = 0;
            setRealtimeConnected(true);
            // Catchup only after a reconnect — the very first SUBSCRIBED on
            // mount has no missed window to recover. Run async; we don't
            // need the channel callback to wait for it.
            if (isReconnect) {
              void runCatchupRef.current();
            } else {
              // First SUBSCRIBED: re-stamp the high-water mark so a fast
              // disconnect/reconnect doesn't reach back further than the
              // mount itself.
              lastEventAtRef.current = Date.now();
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            scheduleRetry(channel, 'channel_error');
          }
        });

      // Arm the handshake watchdog. If neither SUBSCRIBED nor
      // CHANNEL_ERROR/TIMED_OUT fires within SUBSCRIBE_TIMEOUT_MS, the
      // websocket upgrade has silently failed (typically a stale JWT
      // rejected at handshake or a proxy that stripped the auth header)
      // and Supabase will never call back. Treat as channel_error and
      // let the existing backoff ladder recover.
      subscribeTimer = setTimeout(() => {
        if (cancelled) return;
        subscribeTimer = null;
        Sentry.addBreadcrumb({
          category: 'realtime',
          level: 'warning',
          message: `notifications channel subscribe watchdog fired after ${SUBSCRIBE_TIMEOUT_MS}ms`,
        });
        scheduleRetry(channel, 'subscribe_timeout');
      }, SUBSCRIBE_TIMEOUT_MS);

      currentChannel = channel;
    }

    setupChannel();

    // Auth-aware rebind: TOKEN_REFRESHED tears down the stale-JWT channel and
    // recreates it so the new token is bound to the new websocket frame.
    channelRegistry.register(registryKey, {
      resubscribe: () => {
        if (cancelled) return;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (subscribeTimer) {
          clearTimeout(subscribeTimer);
          subscribeTimer = null;
        }
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        // Treat a token-refresh rebind as a reconnect for catchup purposes:
        // bump retryCountRef so the next SUBSCRIBED triggers runCatchup.
        // Without this, a JWT refresh that briefly drops the WS would still
        // miss any rows that landed in the gap.
        retryCountRef.current = 1;
        setupChannel();
      },
      teardown: () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (subscribeTimer) {
          clearTimeout(subscribeTimer);
          subscribeTimer = null;
        }
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        setRealtimeConnected(false);
      },
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (subscribeTimer) clearTimeout(subscribeTimer);
      channelRegistry.unregister(registryKey);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [tenantId]);

  // Fallback polling when realtime is down
  useEffect(() => {
    if (realtimeConnected || !tenantId) return;

    const lastCheck = { current: new Date().toISOString() };

    const pollInterval = setInterval(async () => {
      try {
        // Raw queries intentional — narrow select('id') + created_at filter for polling performance
        const { data: newCalls } = await supabase
          .from('waiter_calls')
          .select('id')
          .eq('tenant_id', tenantId)
          .gt('created_at', lastCheck.current)
          .eq('status', 'pending')
          .limit(1);

        if (newCalls && newCalls.length > 0) {
          playSound('waiterCalls', waiterCallAudioRef.current);
          toast.info(t('notifications.newStaffCall'), {
            description: t('notifications.tableNeedsAssistance'),
            duration: 5000,
          });
        }

        const { data: newOrders } = await supabase
          .from('orders')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .gt('created_at', lastCheck.current)
          .limit(5);

        if (newOrders && newOrders.length > 0) {
          playSound('orders', orderAudioRef.current);
          toast.info(t('notifications.newOrder'), {
            description: t('notifications.newOrderDescription'),
            duration: 3000,
          });
        }

        lastCheck.current = new Date().toISOString();
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'notification-polling' } });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [realtimeConnected, tenantId, playSound, t]);

  return (
    <AudioPrefsContext.Provider value={{ prefs: audioPrefs, toggleChannel }}>
      {children}

      {/* Realtime degraded indicator */}
      {!realtimeConnected && (
        <div className="fixed bottom-4 right-4 z-50 bg-amber-100 text-amber-800 text-xs px-3 py-2 rounded-lg shadow-md border border-amber-200">
          {t('notifications.realtimeDegraded')}
        </div>
      )}
    </AudioPrefsContext.Provider>
  );
}
