/**
 * Type-Safe Takeout Orders Hooks
 * Uses the wrapped client for type safety
 */

import { QUERY_KEYS } from '@gustri/core';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import type { OrderWithDetails } from '@/types';

export function useTakeoutOrders() {
  return useQuery({
    queryKey: [QUERY_KEYS.TAKEOUT_ORDERS],
    queryFn: async (): Promise<OrderWithDetails[]> => db.orders.findTakeoutOrders(),
  });
}
