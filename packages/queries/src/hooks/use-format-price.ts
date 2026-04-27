import { formatPriceWithSettings } from '@gustri/core';
import { useLocale } from '@gustri/i18n';
import { useCallback } from 'react';
import { useCafeSettings } from './use-cafe-settings';

/**
 * Hook that returns a settings-aware price formatting function.
 * Falls back to basic formatting if settings aren't loaded yet.
 *
 * Digit grouping (thousands/decimal separators) follows the active i18n
 * language so a Turkish-speaking user sees `1.234,56₼` regardless of
 * device locale. The cafe's currency symbol/position is preserved.
 */
export function useFormatPrice() {
  const { data: cafeSettings } = useCafeSettings();
  const locale = useLocale();

  return useCallback(
    (amount: number) => {
      if (cafeSettings) {
        return formatPriceWithSettings(amount, cafeSettings, locale);
      }
      return `$${amount.toFixed(2)}`;
    },
    [cafeSettings, locale],
  );
}

/**
 * Hook that returns both `formatPrice` and `cafeSettings` for cases where
 * the component also needs direct access to settings.
 */
export function useFormatPriceWithSettings() {
  const { data: cafeSettings } = useCafeSettings();
  const locale = useLocale();

  const formatPrice = useCallback(
    (amount: number) => {
      if (cafeSettings) {
        return formatPriceWithSettings(amount, cafeSettings, locale);
      }
      return `$${amount.toFixed(2)}`;
    },
    [cafeSettings, locale],
  );

  return { formatPrice, cafeSettings } as const;
}
