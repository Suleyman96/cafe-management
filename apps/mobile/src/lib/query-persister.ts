import { CACHE_SCHEMA_VERSION } from '@gustri/core';
import { QUERY_KEYS } from '@gustri/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { MMKV } from 'react-native-mmkv';
import { getOrCreateMmkvEncryptionKey } from './storage-key';

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
 * The instance is encrypted with a per-install key from the OS keystore
 * (see `storage-key.ts`). MMKV init is async because the key fetch is async,
 * so callers must `await initEncryptedMmkv()` once at app boot before
 * touching `asyncStoragePersister`.
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
 * `CACHE_SCHEMA_VERSION` lives in `@gustri/core` so web persistence (when
 * added) reads the same source of truth — see the JSDoc there for bump
 * semantics. The app-version suffix below is a safety net so any release
 * with a fresh bundle also busts the cache, even if the developer forgot
 * to bump the schema version.
 *
 * Consumed by PersistQueryClientProvider's `persistOptions.buster` — when
 * the value changes between launches, the persister discards the stored
 * client.
 */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const CACHE_BUSTER = `v${CACHE_SCHEMA_VERSION}-${APP_VERSION}`;

const STORAGE_KEY = 'GUSTRI_QUERY_CACHE';
const MMKV_INSTANCE_ID = 'gustri-query-cache';

let storage: MMKV | null = null;
let persister: Persister | null = null;

function buildPersister(mmkv: MMKV): Persister {
  const adapter = {
    setItem: (key: string, value: string) => {
      mmkv.set(key, value);
    },
    getItem: (key: string): string | null => mmkv.getString(key) ?? null,
    removeItem: (key: string) => {
      mmkv.delete(key);
    },
  };

  return createSyncStoragePersister({
    storage: adapter,
    key: STORAGE_KEY,
    throttleTime: 2000,
    serialize: (data: unknown) => JSON.stringify(data),
    deserialize: (data: string) => JSON.parse(data),
  });
}

/**
 * Initialize the encrypted MMKV instance and the persister. Awaitable; safe
 * to call multiple times (subsequent calls are no-ops). Must complete before
 * `PersistQueryClientProvider` mounts and before `asyncStoragePersister` is
 * read.
 *
 * Legacy unencrypted bundles from prior releases won't decrypt under the new
 * key, which manifests as either a throw or unreadable garbage. Either way
 * we wipe the instance — losing the cache is acceptable; rolling out
 * encryption is the priority. Paused mutations on the affected device's
 * first encrypted launch are dropped along with the cache.
 */
export async function initEncryptedMmkv(): Promise<void> {
  if (storage && persister) return;

  const encryptionKey = await getOrCreateMmkvEncryptionKey();

  let mmkv: MMKV;
  try {
    mmkv = new MMKV({ id: MMKV_INSTANCE_ID, encryptionKey });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'mmkv-init' } });
    throw err;
  }

  // Probe-read the persisted blob. If a pre-encryption (legacy) bundle is on
  // disk, MMKV will fail to decrypt and either throw or return garbage that
  // JSON.parse rejects. Wipe and continue.
  try {
    const probe = mmkv.getString(STORAGE_KEY);
    if (probe !== undefined) {
      JSON.parse(probe);
    }
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'cache',
      message: 'legacy unencrypted MMKV detected — wiping',
      level: 'warning',
    });
    Sentry.captureException(err, { tags: { area: 'mmkv-legacy-wipe' } });
    try {
      mmkv.clearAll();
    } catch {
      // Even clearAll can fail on a corrupt instance; nothing more to do.
    }
  }

  storage = mmkv;
  persister = buildPersister(mmkv);
}

function requireStorage(): MMKV {
  if (!storage) {
    throw new Error('Encrypted MMKV not initialized — call initEncryptedMmkv() first');
  }
  return storage;
}

function requirePersister(): Persister {
  if (!persister) {
    throw new Error('Query persister not initialized — call initEncryptedMmkv() first');
  }
  return persister;
}

/**
 * Persister proxy — forwards to the lazily-built sync persister. Created
 * once at module load so consumers (App.tsx, auth.ts) can hold a stable
 * reference; calls before `initEncryptedMmkv()` resolves throw.
 */
export const asyncStoragePersister: Persister = {
  persistClient: (client) => requirePersister().persistClient(client),
  restoreClient: () => requirePersister().restoreClient(),
  removeClient: () => requirePersister().removeClient(),
};

/**
 * Wipes the on-disk encrypted cache outright. Used by logout to ensure no
 * residual MMKV keys (e.g. throttled-write debris) outlive the session.
 * `removeClient()` only removes the React Query blob key; this nukes the
 * whole instance.
 */
export function clearEncryptedQueryCache(): void {
  if (!storage) return;
  try {
    storage.clearAll();
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'mmkv-clear-all' } });
  }
}

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
    const mmkv = requireStorage();
    if (!mmkv.contains(STORAGE_KEY)) {
      mmkv.set(STORAGE_KEY, legacy);
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
    if (!storage) return;
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

// Test-only — wipe internal state between tests.
export function __resetQueryPersisterForTests(): void {
  storage = null;
  persister = null;
}
