import type { MutationCache } from '@tanstack/react-query';

/**
 * Global mutation error handler for offline sync conflicts.
 * When a queued mutation fails after coming back online,
 * this logs the error. UI feedback is handled by individual
 * mutation onError callbacks + the SnackbarProvider.
 */
export function configureSyncErrorHandling(mutationCache: MutationCache) {
  // The mutation cache emits events we can listen to for sync failures.
  // React Query retries the mutation automatically on reconnect.
  // If it still fails (e.g., conflict), the mutation's onError fires.
  // This handler provides centralized logging.
  mutationCache.subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      const error = event.action.error;
      console.warn(
        '[Sync] Mutation failed after reconnect:',
        error instanceof Error ? error.message : error,
      );
    }
  });
}
