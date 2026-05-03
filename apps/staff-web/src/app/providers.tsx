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
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';

/**
 * Rebinds Supabase Realtime channels on JWT refresh.
 *
 * Realtime opens its websocket with the JWT it had at subscribe-time and
 * never re-authenticates when supabase-js refreshes the token (~55 min).
 * The connection then drops silently and consumers (e.g. kitchen view)
 * stall until the safety-net poll catches up. Listening for
 * TOKEN_REFRESHED / SIGNED_IN and resubscribing every active channel
 * keeps the websocket bound to a fresh token.
 */
function RealtimeAuthBridge() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        channelRegistry.resubscribeAll();
      } else if (event === 'SIGNED_OUT') {
        channelRegistry.teardownAll();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
        },
      }),
  );

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DbProvider db={db}>
          <RealtimeAuthBridge />
          <RouteChangeHandler />
          {children}
          <Toaster position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </DbProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
