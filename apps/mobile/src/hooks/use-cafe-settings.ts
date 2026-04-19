// Shared read hook
export { useCafeSettings } from '@gustri/queries';

// Local hook — uses apiRoutes for settings update
import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

export function useUpdateCafeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRoutes.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CAFE_SETTINGS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update cafe settings:', error.message);
    },
  });
}
