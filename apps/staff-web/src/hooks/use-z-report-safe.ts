/**
 * Type-Safe Z-Report Hook
 */

import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useZReport(startDate: string, endDate: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.Z_REPORT, startDate, endDate),
    queryFn: () => db.payments.findByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}
