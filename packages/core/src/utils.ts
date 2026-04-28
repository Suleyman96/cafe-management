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
 * Format price using cafe settings (currency symbol, position, decimals).
 *
 * If `locale` is provided, the numeric portion uses `Intl.NumberFormat` for
 * locale-correct thousands/decimal separators (e.g. `1.234,56` in `de-DE`,
 * `1,234.56` in `en-US`). The cafe's `currency_symbol` and `currency_position`
 * are preserved regardless — the locale only affects digit grouping.
 */
export function formatPriceWithSettings(
  amount: number,
  settings: PricingSettings,
  locale?: string,
): string {
  const decimals = settings.currency_decimal_places;
  let formatted: string;
  if (locale && Number.isFinite(amount)) {
    formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } else {
    formatted = amount.toFixed(decimals);
  }
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
  if (!settings.tax_enabled) return subtotal;
  if (settings.prices_include_tax) {
    const rate = settings.tax_percentage / 100;
    return subtotal / (1 + rate);
  }
  return subtotal;
}

// ─── Cash Change Utilities ───────────────────────────────────────

// ─── Date Utilities ──────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD string in the device's local timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which returns UTC date
 * and produces wrong results near midnight in non-UTC timezones.
 *
 * Locale defaults to `'en-CA'` because YYYY-MM-DD is the canonical *data*
 * format used in DB columns (e.g. `task.due_date`, `expense_date`) and
 * comparisons. Do NOT change the default — use locale-aware display
 * formatters (see `useDateFormatter` in `@gustri/i18n`) for user-facing dates.
 */
export function getLocalDateString(date: Date = new Date(), locale: string = 'en-CA'): string {
  return date.toLocaleDateString(locale);
}

// ─── Order Calculation Utilities ────────────────────────────────

/**
 * Calculate order total — uses order.total if available, falls back to summing non-cancelled items.
 */
export function calculateOrderTotal(order: {
  total?: number | null;
  order_items?: Array<{
    status?: string | null;
    quantity: number;
    item_price: number;
  }> | null;
}): number {
  if (order?.total != null) return order.total;
  if (!order?.order_items) return 0;
  return order.order_items
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => sum + item.quantity * item.item_price, 0);
}

// ─── Time Formatting Utilities ──────────────────────────────────

/**
 * Format elapsed time from a start date to now as "Xm" or "Xh Ym".
 */
export function formatElapsedTime(startDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const diffMs = Date.now() - start.getTime();
  const minutes = Math.floor(diffMs / 1000 / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format a date/time string to localized time (e.g., "02:30 PM").
 */
export function formatTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
