import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useSalesSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['sales-summary', startDate, endDate],
    queryFn: () => db.views.getSalesSummary(startDate, endDate),
  });
}
