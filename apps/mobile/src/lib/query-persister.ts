import { QUERY_KEYS } from '@gustri/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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

/** 4 hours in milliseconds — how long cached data is retained for offline use.
 * Reduced from 24h to prevent AsyncStorage overflow on Android (~6MB limit)
 * while still covering a typical shift. */
export const OFFLINE_GC_TIME = 4 * 60 * 60 * 1000;
