import { useMemo } from 'react';
import { useCafeSettings } from './use-settings';

export function useTaxMultiplier() {
  const { data: settings } = useCafeSettings();

  return useMemo(
    () =>
      settings?.tax_enabled && settings.tax_percentage > 0 ? 1 + settings.tax_percentage / 100 : 1,
    [settings?.tax_enabled, settings?.tax_percentage],
  );
}
