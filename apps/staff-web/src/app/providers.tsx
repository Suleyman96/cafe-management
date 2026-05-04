'use client';

import { isAppError } from '@gustri/core';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import '@/lib/i18n';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { onCrossTab, postCrossTab } from '@/lib/realtime/cross-tab';
import { LifecycleBridge } from '@/lib/realtime/lifecycle-bridge';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Rebinds Supabase Realtime channels on JWT refresh AND wipes the React
 * Query cache on auth boundary changes (sign-out, tenant change).
 *
 * Realtime opens its websocket with the JWT it had at subscribe-time and
 * never re-authenticates when supabase-js refreshes the token (~55 min).
 * The connection then drops silently and consumers (e.g. kitchen view)
 * stall until the safety-net poll catches up. Listening for
 * TOKEN_REFRESHED / SIGNED_IN and resubscribing every active channel
 * keeps the websocket bound to a fresh token.
 *
 * Cache lifecycle (audit fix CRIT-1 + CRIT-2):
 * - SIGNED_OUT → `queryClient.clear()` BEFORE any subsequent navigation so
 *   the next tenant can't see the previous tenant's cached rows during
 *   the gcTime window (5 min default).
 * - SIGNED_IN with a different tenant id than the previously seen one →
 *   also `queryClient.clear()` so a switch-tenant flow on the same tab
 *   gets a clean slate before the first refetch fires.
 */
function RealtimeAuthBridge() {
  const queryClient = useQueryClient();
  const lastTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        // Compare new tenant against the one bound to the wrapper. The
        // wrapper context is set in `loadStaffAndSetup` before the first
        // post-login fetch, so by the time we observe SIGNED_IN here it
        // already reflects the new tenant.
        const currentTenantId = db.getTenantId();
        if (
          lastTenantIdRef.current !== null &&
          currentTenantId !== null &&
          lastTenantIdRef.current !== currentTenantId
        ) {
          queryClient.clear();
        }
        lastTenantIdRef.current = currentTenantId;
        channelRegistry.resubscribeAll();

        // Sentry context (Blocker 7). Tenant + user tags let issue lists
        // group by tenant for "is this tenant having a bad time" triage,
        // and let us mute noise from a single tenant without dropping
        // the rest. Pulled from the auth store rather than the JWT
        // because the store is the source of truth post-login.
        const staff = useAuthStore.getState().staff;
        Sentry.setTag('tenant_id', staff?.tenant_id ?? 'unauth');
        Sentry.setUser(staff ? { id: staff.id, role: staff.role } : null);
      } else if (event === 'SIGNED_OUT') {
        queryClient.clear();
        lastTenantIdRef.current = null;
        channelRegistry.teardownAll();
        Sentry.setTag('tenant_id', 'unauth');
        Sentry.setUser(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return null;
}

/**
 * Bridges BroadcastChannel messages from sibling tabs into the local React
 * Query cache + supabase auth state.
 *
 * - `mutation-success` from another tab → invalidate every active query so
 *   our cache catches the change. Coarse on purpose: avoids drift between
 *   sender and receiver about exactly which keys to refetch and matches
 *   how realtime already converges (refetch from DB, never patch from a
 *   payload).
 * - `signed-out` → wipe cache and call `supabase.auth.signOut()`. The
 *   resulting SIGNED_OUT event flows through `useAuth()` and redirects to
 *   /login. We DO NOT broadcast this back; postCrossTab from this handler
 *   would create an N-tab fanout amplification.
 * - `tenant-changed` → wipe cache. The receiving tab's existing
 *   onAuthStateChange hook will pick up the new session and reload staff.
 */
function CrossTabBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onCrossTab((msg) => {
      switch (msg.kind) {
        case 'mutation-success':
          queryClient.invalidateQueries();
          break;
        case 'signed-out':
          queryClient.clear();
          // Local-only sign-out — never re-broadcast or we'll storm sibling
          // tabs that are themselves about to broadcast their own signed-out.
          supabase.auth.signOut().catch(() => {});
          break;
        case 'tenant-changed':
          queryClient.clear();
          break;
      }
    });
  }, [queryClient]);

  return null;
}

/** Cancel in-flight queries when route changes to free browser connections. */
function RouteChangeHandler() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      queryClient.cancelQueries();
      prevPathRef.current = pathname;
    }
  }, [pathname, queryClient]);

  return null;
}

/**
 * Reads the current staff's tenant id from the auth store and feeds it
 * into `<DbProvider>` so every shared hook tenant-scopes its query key.
 * Reactivity flows through the Zustand selector — when the user signs in
 * or out, this re-renders and DbProvider's context updates.
 */
function TenantBoundDbProvider({ children }: { children: React.ReactNode }) {
  const tenantId = useAuthStore((s) => s.staff?.tenant_id ?? null);
  return (
    <DbProvider db={db} tenantId={tenantId}>
      {children}
    </DbProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (!mutation.options.onError) {
              Sentry.captureException(error);
              toast.error(isAppError(error) ? error.message : 'An unexpected error occurred');
            }
          },
          // Every successful mutation pings sibling tabs to refetch. The
          // originating tab still runs its own fine-grained `onSuccess`
          // invalidations for snappy local UX; the broadcast is the
          // coarse-grained backstop that keeps two tabs of the same staff
          // session converged on payments / order status / table state.
          onSuccess: () => {
            postCrossTab({ kind: 'mutation-success' });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            refetchOnReconnect: true,
            retry: 1,
          },
          // Money mutations must never auto-retry — even idempotent ones
          // are risky at the React Query layer because a paused-then-fired
          // retry can fire after the user thinks the click failed and tried
          // a different action. `retry: 0` keeps retries strictly user-driven.
          // Forms reuse a stable `client_request_id` across user retries via
          // `useStableClientRequestId` so the server dedupes via its
          // (tenant_id, client_request_id) unique indexes.
          // `networkMode: 'online'` is the default in v5 but pinned here so
          // an upstream change can't silently switch to 'always' (which
          // would let mutations fire while offline against a stale token).
          mutations: {
            retry: 0,
            networkMode: 'online',
          },
        },
      }),
  );

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <TenantBoundDbProvider>
          <RealtimeAuthBridge />
          <LifecycleBridge />
          <CrossTabBridge />
          <RouteChangeHandler />
          {children}
          <Toaster position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </TenantBoundDbProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
