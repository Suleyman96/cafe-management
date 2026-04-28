'use client';

/**
 * UI Components Package
 * Shared React components for all platforms
 */

// Export components
export * from './badge';
// Tailwind class helpers (no-React; safe to import from server components)
export { getOrderStatusColor, getRoleBadgeColor } from './badges';
export * from './button';
export * from './gustri-logo';
// Export utilities
export { cn } from './lib/utils';
export * from './loading-spinner';
export * from './number-input';
