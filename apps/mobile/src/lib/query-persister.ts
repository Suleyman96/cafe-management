import { QUERY_KEYS } from '@gustri/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import Constants from 'expo-constants';
import { MMKV } from 'react-native-mmkv';

/**
 * Persists the React Query cache to MMKV so previously fetched data survives
 * app restarts and is available offline.
 *
 * MMKV (JSI-backed, ~30× faster than AsyncStorage and effectively unbounded
 * vs Android's ~6MB AsyncStorage cap) is the right primitive here because
 * the persister is sync — `createSyncStoragePersister` writes synchronously
 * inside React Query's commit, so a fast storage avoids jank during heavy
 * cache churn (kitchen view, table grid). The previous AsyncStorage path
 * also blocked the bridge on each write.
 *
 * Only critical operational data is persisted (orders, tables, menu,
 * settings). Reports and analytics are excluded to keep cache size lean.
 *
 * IMPORTANT: MMKV uses JSI and does not work in Expo Go. Local development
 * must use a development build (`eas build --profile development`).
 */

const PERSISTED_QUERY_KEYS: Set<string> = new Set([
  QUERY_KEYS.ORDERS,
  QUERY_KEYS.ACTIVE_ORDERS,
  QUERY_KEYS.TABLES,
  QUERY_KEYS.TABLE,
  QUERY_KEYS.MENU_ITEMS,
  QUERY_KEYS.CATEGORIES,
  QUERY_KEYS.WAITER_CALLS,
  QUERY_KEYS.CAFE_SETTINGS,
  QUERY_KEYS.DELIVERY_ORDERS,
  QUERY_KEYS.TAKEOUT_ORDERS,
  QUERY_KEYS.STOCK_ITEMS,
  QUERY_KEYS.TASKS,
]);

/**
 * Bump CACHE_SCHEMA_VERSION when changing the SHAPE of any persisted query
 * payload in a way that old serialized data can't be safely deserialized into
 * (e.g. renaming a field on Order, removing a nested column, changing an enum
 * value). The app version suffix is a safety net so any release with a fresh
 * bundle also busts the cache, even if the developer forgot to bump.
 *
 * Without this, an OTA/store update can hydrate a stale cache that the new
 * code mishandles — bugs are subtle because they only repro for users with
 * persisted state.
 *
 * Consumed by PersistQueryClientProvider's `persistOptions.buster` — when the
 * value changes between launches, the persister discards the stored client.
 */
const CACHE_SCHEMA_VERSION = 1;
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const CACHE_BUSTER = `v${CACHE_SCHEMA_VERSION}-${APP_VERSION}`;

const STORAGE_KEY = 'GUSTRI_QUERY_CACHE';

const storage = new MMKV({ id: 'gustri-query-cache' });

/**
 * MMKV-backed adapter shaped like the Web Storage API expected by
 * `createSyncStoragePersister`. MMKV is synchronous so we can implement the
 * sync interface directly — no Promise wrapper needed.
 */
const mmkvStorageAdapter = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

export const asyncStoragePersister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key: STORAGE_KEY,
  throttleTime: 2000,
  serialize: (data: unknown) => JSON.stringify(data),
  deserialize: (data: string) => JSON.parse(data),
});

/**
 * One-time migration from AsyncStorage → MMKV. Runs before the persister
 * hydrates so the cache transition is invisible to users upgrading from a
 * prior release. Idempotent: if MMKV already has the key, we keep its
 * (newer) value and just clear AsyncStorage to reclaim space.
 */
export async function migrateAsyncStorageToMMKV(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (!legacy) return;
    if (!storage.contains(STORAGE_KEY)) {
      storage.set(STORAGE_KEY, legacy);
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'query-cache-migration' } });
  }
}

/**
 * Periodic cache-size sampler. Pushes a Sentry breadcrumb so per-user cache
 * growth shows up alongside any error captured later, and surfaces a warning
 * event once a single user blows past 8MB — the threshold above which we'd
 * want to narrow `PERSISTED_QUERY_KEYS` rather than keep growing the blob.
 *
 * Returns the disposer so callers can stop sampling on unmount.
 */
export function startCacheSizeTelemetry(intervalMs = 60_000): () => void {
  let warned = false;

  const sample = () => {
    const size = storage.size; // bytes — total of all keys in the MMKV instance
    Sentry.addBreadcrumb({
      category: 'cache',
      message: `query-cache size: ${(size / 1024).toFixed(1)} KB`,
      level: size > 5_000_000 ? 'warning' : 'info',
      data: { bytes: size },
    });
    if (size > 8_000_000 && !warned) {
      Sentry.captureMessage('query-cache exceeded 8MB', { level: 'warning' });
      warned = true;
    }
  };

  sample();
  const handle = setInterval(sample, intervalMs);
  return () => {
    clearInterval(handle);
  };
}

/**
 * Filter function for PersistQueryClientProvider.
 * Only persists queries whose first key is in the allowed set.
 */
export function shouldPersistQuery(query: { queryKey: readonly unknown[] }): boolean {
  const firstKey = query.queryKey[0];
  return typeof firstKey === 'string' && PERSISTED_QUERY_KEYS.has(firstKey);
}

/**
 * In-memory garbage-collection time. Keeps the live React Query cache trim
 * during active use; unrelated to how long persisted data lives on disk.
 */
export const OFFLINE_GC_TIME = 4 * 60 * 60 * 1000;

/**
 * Persisted-cache max age — independent from gcTime because disk has more
 * headroom than RAM. 24h covers a waiter relaunching the app the next morning
 * after closing it overnight. With MMKV the legacy ~6MB Android ceiling is
 * gone, but the cache still benefits from this window because beyond 24h the
 * data is worth refetching anyway.
 */
export const PERSISTED_MAX_AGE = 24 * 60 * 60 * 1000;
