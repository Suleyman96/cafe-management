export interface CafeSettingsFormData {
  restaurant_name: string;
  restaurant_address: string | null;
  tax_enabled: boolean;
  tax_percentage: number;
  tax_label: string;
  currency_symbol: string;
  currency_code: string;
  currency_position: 'before' | 'after';
  currency_decimal_places: number;
  minimum_order_amount: number;
  allow_item_notes: boolean;
  allow_order_notes: boolean;
  cafe_logo_url: string | null;
  hero_image_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  welcome_heading: string | null;
  welcome_message: string | null;
  qr_ordering_enabled: boolean;
  tips_enabled: boolean;
  waste_tracking_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee_default: number;
  minimum_delivery_amount: number;
  delivery_zone_info: string | null;
  contact_phone: string | null;
  contact_website: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_tiktok: string | null;
  social_telegram: string | null;
  social_line: string | null;
  location_maps_url: string | null;
  default_language: string;
}

export interface SettingsTabProps {
  formData: CafeSettingsFormData;
  onChange: (field: string, value: string | number | boolean | null) => void;
}
