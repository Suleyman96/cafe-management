'use client';

import type { SupabaseWrapper } from '@gustri/api-client';
import { createContext, useContext, useMemo } from 'react';

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

interface DbContextValue {
  db: SupabaseWrapper;
  /**
   * Tenant id of the currently-authenticated session, sourced from the host
   * app's auth store. `null` when no session is bound (anon flows, signed
   * out). Every shared hook tenant-scopes its query key with this value so
   * tenants never collide in the React Query cache.
   *
   * Apps must pass a reactive value (e.g. a Zustand selector result). When
   * the user signs in or out, this prop must update — otherwise queries
   * created during the brief window before update will key off the wrong
   * tenant.
   */
  tenantId: string | null;
}

const DbContext = createContext<DbContextValue | null>(null);

export function DbProvider({
  db,
  tenantId,
  children,
}: {
  db: SupabaseWrapper;
  /**
   * Tenant id from the host app's auth store. Optional for backwards
   * compatibility — when omitted, the provider falls back to the wrapper's
   * own tenant context (`db.getTenantId()`). Apps that don't pass this prop
   * lose reactivity: hooks won't re-key when the tenant changes mid-session.
   * New code should always pass it.
   */
  tenantId?: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo<DbContextValue>(() => {
    let resolvedTenantId: string | null;
    if (tenantId !== undefined) {
      resolvedTenantId = tenantId;
    } else if (typeof db.getTenantId === 'function') {
      // Fallback for apps that don't (yet) plumb tenantId reactively into
      // DbProvider — read whatever the wrapper has bound at mount time.
      // Test mocks that omit `getTenantId` fall through to `null`.
      resolvedTenantId = db.getTenantId() ?? null;
    } else {
      resolvedTenantId = null;
    }
    return { db, tenantId: resolvedTenantId };
  }, [db, tenantId]);
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): SupabaseWrapper {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error(
      'useDb must be used within a <DbProvider>. Wrap your app in <DbProvider db={db}>.',
    );
  }
  return ctx.db;
}

/**
 * Returns the tenant id bound to the current session, or `null` when no
 * session is bound. Consumed by every shared hook to tenant-scope its query
 * key. Throws if used outside a `<DbProvider>`.
 */
export function useTenantId(): string | null {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error(
      'useTenantId must be used within a <DbProvider>. Wrap your app in <DbProvider db={db} tenantId={…}>.',
    );
  }
  return ctx.tenantId;
}
