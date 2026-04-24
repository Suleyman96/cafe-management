import * as Sentry from '@sentry/react-native';
import type { MutationCache } from '@tanstack/react-query';

type SyncErrorHandler = (error: Error, context: string) => void;

let syncErrorHandler: SyncErrorHandler = () => {};

/**
 * Register a handler for sync errors (e.g., show a snackbar/toast).
 * Call this from the app root after providers are mounted.
 */
export function setSyncErrorHandler(handler: SyncErrorHandler) {
  syncErrorHandler = handler;
}

/**
 * Global mutation error handler for offline sync conflicts.
 * When a queued mutation fails after coming back online,
 * this logs the error and notifies the registered handler.
 */
export function configureSyncErrorHandling(mutationCache: MutationCache) {
  mutationCache.subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      const error = event.action.error;
      const message = error instanceof Error ? error.message : String(error);

      Sentry.captureException(error instanceof Error ? error : new Error(message), {
        tags: { context: 'offline-sync' },
      });

      syncErrorHandler(
        error instanceof Error ? error : new Error(message),
        'sync-mutation-failure',
      );
    }
  });
}
