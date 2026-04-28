import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { registerForPushNotifications } from '@/lib/notifications';
import { getOrCreateMmkvEncryptionKey } from '@/lib/storage-key';
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
 *
 * Dedup state is persisted in MMKV so foreground cycles across cold starts
 * also hit the no-op path. A 7-day max-age forces a periodic re-sync to
 * catch the edge case where the server-side token is cleared by an
 * unrelated process (manual ops, schema change, etc.).
 *
 * Encrypted with the shared keystore key so the dedup composite (which
 * includes staff.id) isn't readable from a pulled MMKV file.
 */
const LAST_SYNCED_KEY = 'last-synced-token';
const LAST_SYNCED_AT_KEY = 'last-synced-at';
const RESYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_MMKV_INSTANCE_ID = 'gustri-push-token';

let tokenStorage: MMKV | null = null;

async function getTokenStorage(): Promise<MMKV> {
  if (tokenStorage) return tokenStorage;
  const encryptionKey = await getOrCreateMmkvEncryptionKey();
  try {
    tokenStorage = new MMKV({ id: TOKEN_MMKV_INSTANCE_ID, encryptionKey });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'push-token-mmkv-init' } });
    throw err;
  }
  // Pre-encryption legacy data won't decrypt. The dedup cache is a write-
  // through optimization — losing it triggers at most one redundant push-
  // token write on next foreground.
  try {
    const probe = tokenStorage.getString(LAST_SYNCED_KEY);
    if (probe !== undefined && typeof probe !== 'string') {
      // unreachable; getString returns string | undefined
    }
  } catch {
    try {
      tokenStorage.clearAll();
    } catch {
      // best-effort
    }
  }
  return tokenStorage;
}

export function clearPushTokenSyncCache() {
  if (!tokenStorage) return;
  tokenStorage.delete(LAST_SYNCED_KEY);
  tokenStorage.delete(LAST_SYNCED_AT_KEY);
}

export function usePushTokenSync() {
  const staffId = useAuthStore((s) => s.staff?.id);

  useEffect(() => {
    if (!staffId) return;

    let cancelled = false;

    async function sync() {
      try {
        const storage = await getTokenStorage();
        const token = await registerForPushNotifications();
        if (cancelled || !token) return;

        const composite = `${staffId}:${token}`;
        const lastSynced = storage.getString(LAST_SYNCED_KEY);
        const lastSyncedAt = storage.getNumber(LAST_SYNCED_AT_KEY) ?? 0;
        const stale = Date.now() - lastSyncedAt > RESYNC_INTERVAL_MS;
        if (lastSynced === composite && !stale) return;

        await db.staff.updatePushToken(staffId!, token);
        storage.set(LAST_SYNCED_KEY, composite);
        storage.set(LAST_SYNCED_AT_KEY, Date.now());
      } catch (err: unknown) {
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
