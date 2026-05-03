import type { Database } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

export function useUpdateCafeSettings(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: CafeSettingsUpdate) => db.settings.update(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.CAFE_SETTINGS) });
    },
    onError: options?.onError,
  });
}
