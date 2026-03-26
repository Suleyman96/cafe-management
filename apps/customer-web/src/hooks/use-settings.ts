import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/query-keys';
import { db } from '@/lib/supabase';

export type CafeSettings = Database['public']['Tables']['cafe_settings']['Row'];

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

// Default settings in case the database fetch fails
const DEFAULT_SETTINGS: CafeSettings = {
  id: SETTINGS_ID,
  restaurant_name: 'Restaurant',
  tax_enabled: true,
  tax_percentage: 18,
  tax_label: 'Tax',
  prices_include_tax: false,
  show_tax_separately: true,
  currency_symbol: '₼',
  currency_code: 'AZN',
  currency_position: 'after',
  currency_decimal_places: 2,
  minimum_order_amount: 0,
  allow_item_notes: true,
  allow_order_notes: true,
  // Branding defaults
  cafe_logo_url: null,
  hero_image_url: null,
  brand_primary_color: '#3B82F6',
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
  created_at: '',
  updated_at: '',
};

export function useCafeSettings() {
  return useQuery({
    queryKey: [QUERY_KEYS.CAFE_SETTINGS],
    queryFn: async (): Promise<CafeSettings> => {
      try {
        return await db.settings.get();
      } catch (error) {
        console.error('Failed to fetch cafe settings:', error);
        return DEFAULT_SETTINGS;
      }
    },
    staleTime: STALE_TIMES.MEDIUM,
    placeholderData: DEFAULT_SETTINGS,
  });
}

// Helper functions that work with settings
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

export function calculateTotal(subtotal: number, settings: CafeSettings): number {
  if (!settings.tax_enabled || settings.prices_include_tax) {
    return subtotal;
  }
  return subtotal + calculateTax(subtotal, settings);
}

export function getDisplaySubtotal(subtotal: number, settings: CafeSettings): number {
  if (!settings.tax_enabled) return subtotal;
  if (settings.prices_include_tax) {
    const rate = settings.tax_percentage / 100;
    return subtotal / (1 + rate);
  }
  return subtotal;
}

export function formatPrice(amount: number, settings: CafeSettings): string {
  const formattedAmount = amount.toFixed(settings.currency_decimal_places);

  if (settings.currency_position === 'before') {
    return `${settings.currency_symbol}${formattedAmount}`;
  }
  return `${formattedAmount}${settings.currency_symbol}`;
}
