/**
 * Shared Utility Functions
 * Platform-agnostic utilities used across all apps
 */

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal: number, taxRate: number = 0.18): number {
  return subtotal * taxRate;
}

/**
 * Calculate total with tax
 */
export function calculateTotal(subtotal: number, taxRate: number = 0.18): number {
  return subtotal + calculateTax(subtotal, taxRate);
}

// ─── Settings-Aware Pricing Utilities ─────────────────────────────

/** Narrow interface so callers can pass full CafeSettings or just pricing fields */
export interface PricingSettings {
  currency_symbol: string;
  currency_position: 'before' | 'after';
  currency_decimal_places: number;
  tax_enabled: boolean;
  tax_percentage: number;
  prices_include_tax: boolean;
}

/**
 * Format price using cafe settings (currency symbol, position, decimals)
 */
export function formatPriceWithSettings(amount: number, settings: PricingSettings): string {
  const formatted = amount.toFixed(settings.currency_decimal_places);
  return settings.currency_position === 'before'
    ? `${settings.currency_symbol}${formatted}`
    : `${formatted}${settings.currency_symbol}`;
}

/**
 * Calculate tax amount based on cafe settings
 * Handles both tax-inclusive and tax-exclusive pricing
 */
export function calculateTaxWithSettings(subtotal: number, settings: PricingSettings): number {
  if (!settings.tax_enabled) return 0;
  if (settings.prices_include_tax) {
    const rate = settings.tax_percentage / 100;
    return subtotal - subtotal / (1 + rate);
  }
  return subtotal * (settings.tax_percentage / 100);
}

/**
 * Calculate total with tax based on cafe settings
 * If prices already include tax, returns subtotal unchanged
 */
export function calculateTotalWithSettings(subtotal: number, settings: PricingSettings): number {
  if (!settings.tax_enabled || settings.prices_include_tax) return subtotal;
  return subtotal + calculateTaxWithSettings(subtotal, settings);
}

/**
 * Get display subtotal (without tax) when prices include tax
 */
export function getDisplaySubtotal(subtotal: number, settings: PricingSettings): number {
  if (settings.prices_include_tax) {
    const rate = settings.tax_percentage / 100;
    return subtotal / (1 + rate);
  }
  return subtotal;
}
