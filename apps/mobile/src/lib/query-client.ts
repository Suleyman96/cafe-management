import { isAppError } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { showSnackbarGlobal } from '@/components/providers/SnackbarProvider';
import { OFFLINE_GC_TIME } from './query-persister';

/**
 * Module-level QueryClient singleton.
 *
 * Lives outside App.tsx so non-component code (e.g. forceLogout in lib/auth.ts)
 * can clear the cache without reaching through React context.
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.onError) return;
    const tags: Record<string, string> = { area: 'mutation' };
    if (isAppError(error)) {
      tags.errorCode = error.code;
      tags.errorName = error.name;
    }
    Sentry.captureException(error, { tags });
    showSnackbarGlobal(isAppError(error) ? error.message : 'An unexpected error occurred');
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: OFFLINE_GC_TIME,
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

export { mutationCache };
