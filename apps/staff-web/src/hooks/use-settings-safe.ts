/**
 * Type-Safe Settings Hooks
 * Uses the wrapped client for type safety
 */

import {
  calculateTaxWithSettings,
  calculateTotalWithSettings,
  formatPriceWithSettings as formatPriceCore,
  QUERY_KEYS,
} from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];
type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

export type { CafeSettings };

export function useCafeSettings() {
  return useQuery({
    queryKey: [QUERY_KEYS.CAFE_SETTINGS],
    queryFn: async (): Promise<CafeSettings> => db.settings.get(),
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
  });
}

export function useUpdateCafeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: CafeSettingsUpdate) => db.settings.update(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CAFE_SETTINGS] });
    },
  });
}

// Re-export pricing utilities from core (aliased to match existing consumer imports)
export const formatPriceWithSettings = formatPriceCore;
export const calculateTax = calculateTaxWithSettings;
export const calculateTotal = calculateTotalWithSettings;
