import {
  calculateTaxWithSettings,
  calculateTotalWithSettings,
  formatPriceWithSettings,
  getDisplaySubtotal,
} from '@gustri/core';
import type { Database } from '@gustri/database';
import { QUERY_KEYS } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/stale-times';
import { db } from '@/lib/supabase';

export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

// Default settings in case the database fetch fails
const DEFAULT_SETTINGS: CafeSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '00000000-0000-0000-0000-000000000000',
  restaurant_name: 'Restaurant',
  tax_enabled: true,
  tax_percentage: 10,
  tax_label: 'Tax',
  prices_include_tax: false,
  show_tax_separately: true,
  currency_symbol: '$',
  currency_code: 'USD',
  currency_position: 'before',
  currency_decimal_places: 0,
  minimum_order_amount: 0,
  allow_item_notes: true,
  allow_order_notes: true,
  // Branding defaults
  cafe_logo_url: null,
  hero_image_url: null,
  brand_primary_color: '#367B8B',
  brand_secondary_color: '#1E40AF',
  // Welcome screen defaults
  welcome_heading: null,
  welcome_message: null,
  // Feature controls
  qr_ordering_enabled: true,
  tips_enabled: false,
  waste_tracking_enabled: false,
  // Delivery defaults
  delivery_enabled: false,
  delivery_fee_default: 0,
  minimum_delivery_amount: 0,
  delivery_zone_info: null,
  restaurant_address: null,
  // Contact & social defaults
  contact_phone: null,
  contact_website: null,
  social_instagram: null,
  social_whatsapp: null,
  social_tiktok: null,
  social_telegram: null,
  social_line: null,
  location_maps_url: null,
  default_language: 'en',
  feature_flags: {},
  refund_type_to_confirm_threshold: 100,
  idle_soft_lock_minutes: 60,
  created_at: '',
  updated_at: '',
};

export function useCafeSettings() {
  // C6 — tenant-scope the query key. Pre-fix the key was a bare
  // [CAFE_SETTINGS] constant, so a single browser session that
  // touched two tenants (one Vercel project serving many customer
  // QR codes) reused the first tenant's settings cache for
  // STALE_TIMES.MEDIUM after switching. Wrong restaurant name,
  // wrong currency, wrong delivery fee until cache expired.
  //
  // `db.getTenantId()` returns null until either the QR landing
  // page calls `setTableContext()` (dine-in) or the delivery flow
  // resolves `qr_token` and binds the wrapper. `enabled: !!tenantId`
  // prevents caching a fetch fired before binding — without that,
  // the pre-bind read would land under a `null` key and the first
  // post-bind tenant would reuse the null-cached row.
  const tenantId = db.getTenantId();

  return useQuery({
    queryKey: [QUERY_KEYS.CAFE_SETTINGS, tenantId],
    queryFn: async (): Promise<CafeSettings> => {
      try {
        return await db.settings.get();
      } catch (error) {
        Sentry.captureException(error);
        return DEFAULT_SETTINGS;
      }
    },
    enabled: !!tenantId,
    staleTime: STALE_TIMES.MEDIUM,
    placeholderData: DEFAULT_SETTINGS,
  });
}

// Re-export pricing utilities from core (aliased to match existing consumer imports)
export const calculateTax = calculateTaxWithSettings;
export const calculateTotal = calculateTotalWithSettings;
export const formatPrice = formatPriceWithSettings;
export { getDisplaySubtotal };
