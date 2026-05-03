import type { Database } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

export function useCafeSettings(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.CAFE_SETTINGS),
    queryFn: () => db.settings.get() as Promise<CafeSettings>,
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
}
