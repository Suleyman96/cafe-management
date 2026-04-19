import { formatPriceWithSettings } from '@gustri/core';
import { useCallback } from 'react';
import { useCafeSettings } from './use-cafe-settings';

/**
 * Hook that returns a settings-aware price formatting function.
 * Falls back to basic formatting if settings aren't loaded yet.
 */
export function useFormatPrice() {
  const { data: cafeSettings } = useCafeSettings();

  return useCallback(
    (amount: number) => {
      if (cafeSettings) {
        return formatPriceWithSettings(amount, cafeSettings);
      }
      return `$${amount.toFixed(2)}`;
    },
    [cafeSettings],
  );
}

/**
 * Hook that returns both `formatPrice` and `cafeSettings` for cases where
 * the component also needs direct access to settings.
 */
export function useFormatPriceWithSettings() {
  const { data: cafeSettings } = useCafeSettings();

  const formatPrice = useCallback(
    (amount: number) => {
      if (cafeSettings) {
        return formatPriceWithSettings(amount, cafeSettings);
      }
      return `$${amount.toFixed(2)}`;
    },
    [cafeSettings],
  );

  return { formatPrice, cafeSettings } as const;
}
