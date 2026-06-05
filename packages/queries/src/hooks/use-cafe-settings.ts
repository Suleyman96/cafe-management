import type { Database } from '@gustri/database/types';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import { STALE_TIMES } from '../stale-times';

export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

export function useCafeSettings(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.CAFE_SETTINGS),
    queryFn: () => db.settings.get() as Promise<CafeSettings>,
    staleTime: STALE_TIMES.MEDIUM,
    enabled: options?.enabled ?? true,
  });
}
