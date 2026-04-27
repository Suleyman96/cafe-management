import { QUERY_KEYS } from '@gustri/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import Constants from 'expo-constants';

/**
 * Persists the React Query cache to AsyncStorage so that previously
 * fetched data survives app restarts and is available offline.
 *
 * Only critical operational data is persisted (orders, tables, menu, settings).
 * Reports and analytics are excluded to keep cache size manageable
 * within AsyncStorage's ~6MB Android limit.
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

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'GUSTRI_QUERY_CACHE',
  throttleTime: 2000,
  serialize: (data: unknown) => JSON.stringify(data),
  deserialize: (data: string) => JSON.parse(data),
});

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
 * after closing it overnight. If an audit later shows the persisted blob
 * exceeds AsyncStorage's ~6MB Android limit, the right lever is narrowing
 * PERSISTED_QUERY_KEYS, not shortening this window.
 */
export const PERSISTED_MAX_AGE = 24 * 60 * 60 * 1000;
