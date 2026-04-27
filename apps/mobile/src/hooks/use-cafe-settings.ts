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
