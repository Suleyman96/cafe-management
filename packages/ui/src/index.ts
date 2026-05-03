'use client';

/**
 * UI Components Package
 * Shared React components for all platforms
 */

// Export components
export * from './badge';
// Tailwind class helpers (no-React; safe to import from server components)
export {
  type BadgeConfig,
  getOrderStatusColor,
  getRoleBadgeColor,
  ORDER_ITEM_STATUS_BADGES,
  ORDER_STATUS_BADGES,
  PAYMENT_METHOD_BADGES,
  TABLE_STATUS_BADGES,
  USER_ROLE_BADGES,
} from './badges';
export * from './button';
export * from './gustri-logo';
// Export utilities
export { cn } from './lib/utils';
export * from './loading-spinner';
