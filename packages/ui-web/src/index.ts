'use client';

/**
 * @gustri/ui-web
 *
 * React components and Tailwind class helpers for the web apps
 * (`staff-web`, `customer-web`, `marketing`). Components that depend on
 * DOM types (`HTMLInputElement`, `document`, `window`, scroll/wheel
 * events) and Tailwind class strings live here. Mobile (`apps/mobile`)
 * must not depend on this package — it consumes `@gustri/ui-mobile`
 * (which mirrors the same component contracts using
 * `react-native-paper`).
 *
 * Token primitives (colors, spacing, typography, radii, elevation,
 * shared component prop contracts) live in `@gustri/design-tokens` and
 * are consumed by both UI packages.
 */

// Re-export the headless `BadgeConfig` contract so consumers of
// `@gustri/ui-web` don't have to chase the shape down to `@gustri/design-tokens`.
export type { BadgeConfig } from '@gustri/design-tokens';
// React components
export * from './badge';
// Tailwind class helpers — no React, safe to import from server components.
export {
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
// Utilities
export { cn } from './lib/utils';
export * from './loading-spinner';
export * from './number-input';
