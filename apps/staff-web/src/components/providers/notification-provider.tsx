'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Bell, BellOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

type OrderRow = Database['public']['Tables']['orders']['Row'];

const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;
const POLL_INTERVAL_MS = 120_000; // 2 minutes — matches REFRESH_INTERVALS.FALLBACK

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('staff');
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff-audio-enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const waiterCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const orderAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(audioEnabled);
  const audioUnlockedRef = useRef(false);
  // Queue: store pending sound to play once unlocked
  const pendingSoundRef = useRef<HTMLAudioElement | null>(null);

  // Retry + connection state for realtime subscriptions
  const retryCountRef = useRef(0);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Keep ref in sync
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

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

  // Save preferences
  useEffect(() => {
    localStorage.setItem('staff-audio-enabled', String(audioEnabled));
  }, [audioEnabled]);

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

        // Play the queued sound if there is one
        if (pendingSoundRef.current && audioEnabledRef.current) {
          pendingSoundRef.current.volume = 1;
          pendingSoundRef.current.currentTime = 0;
          pendingSoundRef.current.play().catch(() => {});
          pendingSoundRef.current = null;
        }
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

  // Play sound helper - queues if not yet unlocked
  const playSound = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio || !audioEnabledRef.current) return;

    if (!audioUnlockedRef.current) {
      // Audio not unlocked yet - queue it for when user interacts
      pendingSoundRef.current = audio;
      return;
    }

    audio.currentTime = 0;
    audio.play().catch((err) => {
      Sentry.addBreadcrumb({
        category: 'audio',
        message: 'Audio play failed',
        level: 'warning',
        data: { error: err.message },
      });
    });
  }, []);

  // Toggle audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);

    if (newState && notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current
        .play()
        .then(() => {
          audioUnlockedRef.current = true;
          toast.success(t('notifications.enabled'));
        })
        .catch((err) => {
          Sentry.addBreadcrumb({
            category: 'audio',
            message: 'Audio play failed on toggle',
            level: 'warning',
            data: { error: err.message },
          });
          toast.error(t('notifications.enableFailed'));
        });
    } else if (!newState) {
      toast.info(t('notifications.muted'));
    }
  };

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
    let cancelled = false;

    function setupChannel() {
      if (cancelled) return;
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
            if (payload.eventType === 'INSERT') {
              playSound(waiterCallAudioRef.current);
              toast.info(t('notifications.newStaffCall'), {
                description: t('notifications.tableNeedsAssistance'),
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
            if (payload.eventType === 'INSERT') {
              const newOrder = payload.new as OrderRow;
              if (newOrder.status === 'pending_approval') {
                playSound(notificationAudioRef.current);
                toast.info(t('notifications.newQrOrder'), {
                  description: t('notifications.qrOrderDescription'),
                  duration: 5000,
                });
              } else {
                playSound(orderAudioRef.current);
                toast.info(t('notifications.newOrder'), {
                  description: t('notifications.newOrderDescription'),
                  duration: 3000,
                });
              }
            }
            if (payload.eventType === 'UPDATE') {
              const newOrder = payload.new as OrderRow;
              const oldOrder = payload.old as Partial<OrderRow>;
              if (newOrder.status === 'ready' && oldOrder.status !== 'ready') {
                Sentry.addBreadcrumb({ category: 'realtime', message: 'Order ready notification' });
                playSound(notificationAudioRef.current);
                toast.success(t('notifications.orderReady'), {
                  description: t('notifications.orderReadyDescription'),
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
            if (payload.eventType === 'INSERT') {
              playSound(orderAudioRef.current);
              toast.info(t('notifications.newItemsAdded'), {
                description: t('notifications.itemsAddedDescription'),
                duration: 3000,
              });
            }
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          Sentry.addBreadcrumb({
            category: 'realtime',
            message: `notifications channel: ${status}`,
          });

          if (status === 'SUBSCRIBED') {
            retryCountRef.current = 0;
            setRealtimeConnected(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeConnected(false);
            supabase.removeChannel(channel);
            if (currentChannel === channel) currentChannel = null;

            if (retryCountRef.current >= MAX_RETRIES) {
              Sentry.captureMessage(
                'Notification realtime: max retries exceeded, falling back to polling',
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
        });

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
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        retryCountRef.current = 0;
        setupChannel();
      },
      teardown: () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
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
      channelRegistry.unregister(registryKey);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [playSound, t, tenantId]);

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
          playSound(waiterCallAudioRef.current);
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
          playSound(orderAudioRef.current);
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
    <>
      {children}

      {/* Realtime degraded indicator */}
      {!realtimeConnected && (
        <div className="fixed bottom-16 right-4 z-50 bg-amber-100 text-amber-800 text-xs px-3 py-2 rounded-lg shadow-md border border-amber-200">
          {t('notifications.realtimeDegraded', 'Live updates paused — checking periodically')}
        </div>
      )}

      {/* Global Audio Toggle Button */}
      <button
        onClick={toggleAudio}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${
          audioEnabled
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-500 hover:bg-gray-600 text-white'
        }`}
        title={
          audioEnabled
            ? t('notifications.notificationsOnTitle')
            : t('notifications.notificationsOffTitle')
        }
      >
        {audioEnabled ? (
          <Bell className="h-5 w-5 animate-pulse" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
        <span className="text-sm font-medium hidden sm:inline">
          {audioEnabled ? t('notifications.soundOn') : t('notifications.soundOff')}
        </span>
      </button>
    </>
  );
}
