import { useCallback } from 'react';
import { formatPrice } from '@/lib/utils';
import { formatPrice as formatPriceWithSettings, useCafeSettings } from './use-settings';

/**
 * Returns a function that formats a price using cafe settings (currency symbol, position, decimals).
 * Falls back to basic formatting if settings aren't loaded yet.
 */
export function useFormatPrice() {
  const { data: settings } = useCafeSettings();

  return useCallback(
    (amount: number) => {
      if (settings) {
        return formatPriceWithSettings(amount, settings);
      }
      return formatPrice(amount);
    },
    [settings],
  );
}
