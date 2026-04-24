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
import { db } from '@/lib/supabase/wrapped-client';

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
          <RouteChangeHandler />
          {children}
          <Toaster position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </DbProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
