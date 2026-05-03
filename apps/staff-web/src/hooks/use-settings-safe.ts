/**
 * Type-Safe Settings Hooks
 */
import {
  calculateTaxWithSettings,
  calculateTotalWithSettings,
  formatPriceWithSettings as formatPriceCore,
} from '@gustri/core';
import type { Database } from '@gustri/database';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

// Re-export shared hooks
export { type CafeSettings, useCafeSettings } from '@gustri/queries';

type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

// Staff-web uses apiRoutes for settings update (server-side validation)
export function useUpdateCafeSettings() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (updates: CafeSettingsUpdate) =>
      apiRoutes.settings.update(updates as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.CAFE_SETTINGS) });
    },
  });
}

// Re-export pricing utilities from core
export const formatPriceWithSettings = formatPriceCore;
export const calculateTax = calculateTaxWithSettings;
export const calculateTotal = calculateTotalWithSettings;
