import { useMemo } from 'react';
import { useCafeSettings } from './use-settings-safe';

/**
 * Returns a multiplier for displaying tax-inclusive prices on menu items.
 * - When tax is enabled: multiplier adds tax (e.g., 1.18 for 18%)
 * - When tax is disabled: multiplier is 1
 */
export function useTaxMultiplier() {
  const { data: settings } = useCafeSettings();

  return useMemo(
    () =>
      settings?.tax_enabled && settings.tax_percentage > 0 ? 1 + settings.tax_percentage / 100 : 1,
    [settings?.tax_enabled, settings?.tax_percentage],
  );
}
