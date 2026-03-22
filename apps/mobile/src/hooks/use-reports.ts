import { QUERY_KEYS } from '@cafe-idare/core';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

type SalesSummaryRow = Record<string, unknown>;

export function useSalesSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SALES, startDate, endDate],
    queryFn: async (): Promise<SalesSummaryRow[]> => db.views.getSalesSummary(startDate, endDate),
  });
}
