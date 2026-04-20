import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

export function useCafeSettings() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.CAFE_SETTINGS],
    queryFn: () => db.settings.get() as Promise<CafeSettings>,
    staleTime: 1000 * 60 * 5,
  });
}
