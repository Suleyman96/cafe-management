import * as Sentry from '@sentry/react-native';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { registerForPushNotifications } from '@/lib/notifications';
import { db } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

/**
 * Re-checks the Expo push token on every app foreground transition and on
 * staff change. Writes to staff.push_token only when the token has actually
 * changed, to avoid hammering the DB on every foreground.
 *
 * Replaces the one-shot effect that only ran on staff.id change — Expo push
 * tokens can rotate after OS updates or FCM refresh, and the previous code
 * would silently miss the new token until the next login.
 */
export function usePushTokenSync() {
  const staffId = useAuthStore((s) => s.staff?.id);
  const lastSyncedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!staffId) {
      lastSyncedToken.current = null;
      return;
    }

    let cancelled = false;

    async function sync() {
      try {
        const token = await registerForPushNotifications();
        if (cancelled || !token || token === lastSyncedToken.current) return;
        await db.staff.updatePushToken(staffId!, token);
        lastSyncedToken.current = token;
      } catch (err) {
        Sentry.captureException(err, { tags: { area: 'push-token-sync' } });
      }
    }

    void sync();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [staffId]);
}
