'use client';

import type { SupabaseWrapper } from '@gustri/api-client';
import { createContext, useContext } from 'react';

/**
 * Trailing-debounce window for coalescing realtime-driven query
 * invalidations. Apps that subscribe to Supabase Realtime should use this
 * value so a burst of events on the same query key produces a single
 * refetch instead of one per event.
 *
 * Tighten toward 200ms if UX feels laggy; loosen toward 500ms if servers
 * struggle under burst load.
 */
export const REALTIME_INVALIDATE_DEBOUNCE_MS = 300;

const DbContext = createContext<SupabaseWrapper | null>(null);

export function DbProvider({ db, children }: { db: SupabaseWrapper; children: React.ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): SupabaseWrapper {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error(
      'useDb must be used within a <DbProvider>. Wrap your app in <DbProvider db={db}>.',
    );
  }
  return db;
}
