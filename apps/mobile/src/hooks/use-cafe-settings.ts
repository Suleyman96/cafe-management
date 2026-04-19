import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase';

type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

export function useCafeSettings() {
  return useQuery({
    queryKey: [QUERY_KEYS.CAFE_SETTINGS],
    queryFn: async (): Promise<CafeSettings> => db.settings.get(),
  });
}

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
