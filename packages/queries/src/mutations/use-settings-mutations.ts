import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../provider';

type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

export function useUpdateCafeSettings() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: CafeSettingsUpdate) => db.settings.update(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CAFE_SETTINGS] });
    },
  });
}
