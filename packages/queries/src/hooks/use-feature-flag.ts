import { useCafeSettings } from './use-cafe-settings';

/**
 * Read a per-tenant feature flag from cafe_settings.feature_flags.
 *
 * Usage:
 *   const deliveryV2 = useFeatureFlag('delivery_v2');
 *   if (!deliveryV2) return <OldDeliveryFlow />;
 */
export function useFeatureFlag(flag: string, defaultValue = false): boolean {
  const { data: settings } = useCafeSettings();
  if (!settings) return defaultValue;

  const flags = (settings as Record<string, unknown>).feature_flags;
  if (!flags || typeof flags !== 'object') return defaultValue;

  return (flags as Record<string, unknown>)[flag] === true;
}
