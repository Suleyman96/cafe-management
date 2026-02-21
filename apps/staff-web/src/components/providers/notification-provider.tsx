'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Bell, BellOff } from 'lucide-react';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
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
      const allAudios = [waiterCallAudioRef.current, orderAudioRef.current, notificationAudioRef.current];
      const unlockPromises = allAudios.map((audio) => {
        if (!audio) return Promise.resolve();
        audio.volume = 0;
        return audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
        }).catch(() => {});
      });

      // After all unlocked, play any pending sound
      Promise.all(unlockPromises).then(() => {
        audioUnlockedRef.current = true;
        console.log('[Notifications] Audio unlocked via user interaction');

        // Play the queued sound if there is one
        if (pendingSoundRef.current && audioEnabledRef.current) {
          console.log('[Notifications] Playing queued notification sound');
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
  const playSound = (audio: HTMLAudioElement | null) => {
    if (!audio || !audioEnabledRef.current) return;

    if (!audioUnlockedRef.current) {
      // Audio not unlocked yet - queue it for when user interacts
      console.log('[Notifications] Audio locked, queuing sound');
      pendingSoundRef.current = audio;
      return;
    }

    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error('Audio play failed:', err.message);
    });
  };

  // Toggle audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);

    if (newState && notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current.play()
        .then(() => {
          audioUnlockedRef.current = true;
          toast.success('Notifications enabled!');
        })
        .catch((err) => {
          console.error('Audio play failed:', err.message);
          toast.error('Could not enable sound. Try clicking again.');
        });
    } else if (!newState) {
      toast.info('Notifications muted');
    }
  };

  // Waiter calls subscription
  useEffect(() => {
    console.log('[Notifications] Setting up waiter_calls subscription');
    const channel = supabase
      .channel('notify-waiter-calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          console.log('[Notifications] waiter_calls event:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            playSound(waiterCallAudioRef.current);
            toast.info('New staff call!', {
              description: 'Table needs assistance',
              duration: 5000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Notifications] waiter_calls status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Orders subscription
  useEffect(() => {
    console.log('[Notifications] Setting up orders subscription');
    const channel = supabase
      .channel('notify-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[Notifications] orders event:', payload.eventType, payload);
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            if (newOrder.status === 'pending_approval') {
              playSound(notificationAudioRef.current);
              toast.info('New QR Order!', {
                description: 'Customer placed an order via QR code',
                duration: 5000,
              });
            } else {
              playSound(orderAudioRef.current);
              toast.info('New Order!', {
                description: 'New order created',
                duration: 3000,
              });
            }
          }
          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as any;
            const oldOrder = payload.old as any;
            if (newOrder.status === 'ready' && oldOrder.status !== 'ready') {
              console.log('[Notifications] Order ready!');
              playSound(notificationAudioRef.current);
              toast.success('Order Ready!', {
                description: 'An order is ready to be served',
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Notifications] orders status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Order items subscription (for items added to existing orders)
  useEffect(() => {
    console.log('[Notifications] Setting up order_items subscription');
    const channel = supabase
      .channel('notify-order-items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          console.log('[Notifications] order_items event:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            playSound(orderAudioRef.current);
            toast.info('New items added!', {
              description: 'Items were added to an order',
              duration: 3000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Notifications] order_items status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {children}

      {/* Global Audio Toggle Button */}
      <button
        onClick={toggleAudio}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${
          audioEnabled
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-500 hover:bg-gray-600 text-white'
        }`}
        title={audioEnabled ? 'Notifications ON (click to mute)' : 'Notifications OFF (click to enable)'}
      >
        {audioEnabled ? (
          <Bell className="h-5 w-5 animate-pulse" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
        <span className="text-sm font-medium hidden sm:inline">
          {audioEnabled ? 'Sound ON' : 'Sound OFF'}
        </span>
      </button>
    </>
  );
}
