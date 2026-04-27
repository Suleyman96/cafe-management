// Shared read hook
export { useCafeSettings } from '@gustri/queries';

// Local hook — uses apiRoutes for settings update
import { QUERY_KEYS, validateOrThrow } from '@gustri/core';
import { CafeSettingsUpdateInputSchema } from '@gustri/database';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

export function useUpdateCafeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    // Settings are tenant-wide and admin-only — queueing a stale tax/currency
    // change for replay later can corrupt receipts written between now and
    // the replay. Fail fast and require online connectivity.
    networkMode: 'always',
    retry: 0,
    mutationFn: (data: unknown) => {
      const validated = validateOrThrow(
        CafeSettingsUpdateInputSchema,
        data,
        'Invalid cafe settings',
      );
      return apiRoutes.settings.update(validated as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CAFE_SETTINGS] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'updateCafeSettings' } });
    },
  });
}
