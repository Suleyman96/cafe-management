/**
 * Type-Safe Z-Report Hook
 */

import { QUERY_KEYS } from '@gustri/core';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useZReport(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.Z_REPORT, startDate, endDate],
    queryFn: () => db.payments.findByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}
