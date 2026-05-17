import { isAppError, OFFLINE_SYNC_WINDOW_MS } from '@gustri/core';
import { i18n, localizeErrorMessage } from '@gustri/i18n';
import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { showSnackbarGlobal } from '@/components/providers/SnackbarProvider';
import { networkErrorIsRetryable } from './mutation-defaults';
import { wasOfflineRecently } from './online-state';
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

    // Detect sync-replay failures — the device was offline within
    // OFFLINE_SYNC_WINDOW_MS, so this mutation almost certainly came off
    // the paused queue. Surface it differently so the user understands a
    // queued change failed rather than something they just did.
    const isSyncReplay = wasOfflineRecently(OFFLINE_SYNC_WINDOW_MS);
    if (isSyncReplay) {
      tags.context = 'offline-sync-replay';
    }

    Sentry.captureException(error, { tags });

    const fallback = i18n.t('somethingWentWrong', {
      ns: 'common',
      defaultValue: 'An unexpected error occurred',
    });
    const userMessage = isAppError(error)
      ? localizeErrorMessage(error.message, fallback)
      : fallback;
    const syncReplayPrefix = i18n.t('syncReplayFailedPrefix', { ns: 'common' });
    showSnackbarGlobal(isSyncReplay ? `${syncReplayPrefix}: ${userMessage}` : userMessage);
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
      // 'online' = pause when onlineManager reports offline. Combined with the
      // retry policy below, a network failure pauses the mutation for replay
      // when connectivity returns. Mutations that must NEVER queue (payments,
      // refunds, discounts, settings, stock-adjust) override this with
      // `networkMode: 'always'` at the call site.
      networkMode: 'online',
      retry: (failureCount, error) => failureCount < 3 && networkErrorIsRetryable(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});
