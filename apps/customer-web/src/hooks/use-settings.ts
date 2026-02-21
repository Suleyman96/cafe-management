import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CafeSettings {
  id: string;
  restaurant_name: string;
  tax_enabled: boolean;
  tax_percentage: number;
  tax_label: string;
  prices_include_tax: boolean;
  show_tax_separately: boolean;
  currency_symbol: string;
  currency_code: string;
  currency_position: 'before' | 'after';
  currency_decimal_places: number;
  minimum_order_amount: number;
  allow_item_notes: boolean;
  allow_order_notes: boolean;
  // Branding fields
  cafe_logo_url: string | null;
  hero_image_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  // Welcome screen
  welcome_heading: string | null;
  welcome_message: string | null;
  // Feature controls
  qr_ordering_enabled: boolean;
  // Contact & social
  contact_phone: string | null;
  contact_website: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  location_maps_url: string | null;
}

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
  // Contact & social defaults
  contact_phone: null,
  contact_website: null,
  social_instagram: null,
  social_whatsapp: null,
  location_maps_url: null,
};

export function useCafeSettings() {
  return useQuery({
    queryKey: ['cafe_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .single();

      if (error) {
        console.error('Failed to fetch cafe settings:', error);
        return DEFAULT_SETTINGS;
      }

      return data as CafeSettings;
    },
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
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
