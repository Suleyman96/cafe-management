/**
 * Type-Safe Settings Hooks
 * Uses the wrapped client for type safety
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
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

/**
 * Format price using cafe settings
 */
export function formatPriceWithSettings(amount: number, settings: CafeSettings): string {
  const formattedAmount = amount.toFixed(settings.currency_decimal_places);

  if (settings.currency_position === 'before') {
    return `${settings.currency_symbol}${formattedAmount}`;
  }
  return `${formattedAmount}${settings.currency_symbol}`;
}

/**
 * Calculate tax amount based on settings
 */
export function calculateTax(subtotal: number, settings: CafeSettings): number {
  if (!settings.tax_enabled) return 0;

  if (settings.prices_include_tax) {
    // If prices include tax, extract tax from subtotal
    const rate = settings.tax_percentage / 100;
    const priceWithoutTax = subtotal / (1 + rate);
    return subtotal - priceWithoutTax;
  } else {
    // If prices don't include tax, calculate tax on subtotal
    return subtotal * (settings.tax_percentage / 100);
  }
}

/**
 * Calculate total with tax based on settings
 */
export function calculateTotal(subtotal: number, settings: CafeSettings): number {
  if (!settings.tax_enabled || settings.prices_include_tax) {
    return subtotal;
  }
  return subtotal + calculateTax(subtotal, settings);
}
