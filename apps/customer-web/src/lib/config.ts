/**
 * App Configuration
 *
 * This file contains configurable settings for the customer-facing app.
 * In production, these could be loaded from environment variables or a database.
 */

export const appConfig = {
  // Restaurant name
  restaurantName: "Café İdarə",

  // Tax settings
  tax: {
    // Whether to show tax as a separate line item
    showTaxSeparately: true,

    // Tax percentage (e.g., 18 for 18%)
    percentage: 18,

    // Whether prices displayed on menu include tax
    // true = prices shown are final (tax included)
    // false = prices shown are before tax (tax added at checkout)
    pricesIncludeTax: false,

    // Label to show for tax line item
    label: "Tax",
  },

  // Currency settings
  currency: {
    symbol: "₼",
    code: "AZN",
    position: "after" as "before" | "after", // "before" = $10, "after" = 10₼
    decimalPlaces: 2,
  },

  // Order settings
  order: {
    // Minimum order amount (0 = no minimum)
    minimumAmount: 0,

    // Whether customers can add notes to individual items
    allowItemNotes: true,

    // Whether customers can add notes to the entire order
    allowOrderNotes: true,
  },
} as const;

// Helper function to calculate tax
export function calculateTax(subtotal: number): number {
  if (appConfig.tax.pricesIncludeTax) {
    // If prices include tax, extract tax from subtotal
    // subtotal = price + (price * rate) = price * (1 + rate)
    // price = subtotal / (1 + rate)
    // tax = subtotal - price
    const rate = appConfig.tax.percentage / 100;
    const priceWithoutTax = subtotal / (1 + rate);
    return subtotal - priceWithoutTax;
  } else {
    // If prices don't include tax, calculate tax on subtotal
    return subtotal * (appConfig.tax.percentage / 100);
  }
}

// Helper function to get total (subtotal + tax or just subtotal if tax included)
export function calculateTotal(subtotal: number): number {
  if (appConfig.tax.pricesIncludeTax) {
    // Prices already include tax
    return subtotal;
  } else {
    // Add tax to subtotal
    return subtotal + calculateTax(subtotal);
  }
}

// Helper to get display subtotal (without tax if prices include tax)
export function getDisplaySubtotal(subtotal: number): number {
  if (appConfig.tax.pricesIncludeTax) {
    // Extract price without tax for display
    const rate = appConfig.tax.percentage / 100;
    return subtotal / (1 + rate);
  }
  return subtotal;
}

export type AppConfig = typeof appConfig;
