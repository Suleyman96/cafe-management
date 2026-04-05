import { QUERY_KEYS } from '@gustri/core';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Order } from '@/types';

export function useTakeoutOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.TAKEOUT_ORDERS],
    queryFn: async (): Promise<Order[]> => db.orders.findTakeoutOrders(),
    staleTime: 0,
  });
}
