/**
 * Shared Color Tokens
 *
 * Single source of truth for color values used across web and mobile. Web
 * consumes via `@gustri/ui-web/badges` (which derives Tailwind class strings
 * matching these hexes), and mobile consumes the hex values directly.
 *
 * Values-only — never import React or DOM here so the package can be
 * resolved from headless contexts (Node scripts, RN, SSR).
 */

// ─── Brand ─────────────────────────────────────────────────────────

/** Brand primary — the teal accent used across the app. */
export const BRAND_PRIMARY = '#367B8B';

// ─── Badge contract ───────────────────────────────────────────────

/**
 * Shape both web (`@gustri/ui-web/badges`, Tailwind class strings) and mobile
 * (`StatusBadge`, hex values) populate. The optional fields let later phases
 * add outline / pulse / icon variants without diverging contracts between
 * platforms.
 */
export interface BadgeConfig {
  /** Background — Tailwind class on web (`bg-amber-100`), hex on mobile (`#fef3c7`). */
  bg: string;
  /** Text — Tailwind class on web (`text-amber-800`), hex on mobile (`#92400e`). */
  text: string;
  /** Default i18n key for the badge label — consumers may override per-context. */
  labelKey: string;
  /** Optional border — Tailwind class on web (`border-amber-300`), hex on mobile. */
  border?: string;
  /** Whether the badge/card should pulse to draw attention (e.g. emergency, new order). */
  pulse?: boolean;
  /** Optional icon name (lucide on web, MaterialCommunityIcons on mobile). */
  iconName?: string;
}

/** Narrow alias for the bg/text pair, used by mobile components that only need colors. */
export type StatusColorPair = Pick<BadgeConfig, 'bg' | 'text'>;

// ─── Order Status ──────────────────────────────────────────────

export const ORDER_STATUS_HEX: Record<string, BadgeConfig> = {
  pending_approval: { bg: '#fef3c7', text: '#92400e', labelKey: 'orders.pendingApproval' }, // amber-100 / amber-800
  new: { bg: '#dbeafe', text: '#1e40af', labelKey: 'orders.new' }, // blue-100 / blue-800
  preparing: { bg: '#fef9c3', text: '#854d0e', labelKey: 'orders.preparing' }, // yellow-100 / yellow-800
  ready: { bg: '#dcfce7', text: '#166534', labelKey: 'orders.ready' }, // green-100 / green-800
  served: { bg: '#f3e8ff', text: '#6b21a8', labelKey: 'orders.served' }, // purple-100 / purple-800
  out_for_delivery: { bg: '#ede9fe', text: '#5b21b6', labelKey: 'orders.outForDelivery' }, // violet-100 / violet-800
  delivered: { bg: '#d1fae5', text: '#065f46', labelKey: 'orders.delivered' }, // emerald-100 / emerald-800
  cancelled: { bg: '#fee2e2', text: '#991b1b', labelKey: 'orders.cancelled' }, // red-100 / red-800
  closed: { bg: '#f3f4f6', text: '#1f2937', labelKey: 'orders.closed' }, // gray-100 / gray-800
};

// ─── Table Status ──────────────────────────────────────────────

export const TABLE_STATUS_HEX: Record<string, BadgeConfig> = {
  free: { bg: '#dcfce7', text: '#15803d', labelKey: 'tables.free' }, // green-100 / green-700
  occupied: { bg: '#ffedd5', text: '#c2410c', labelKey: 'tables.occupied' }, // orange-100 / orange-700
  reserved: { bg: '#dbeafe', text: '#1d4ed8', labelKey: 'tables.reserved' }, // blue-100 / blue-700
  closed: { bg: '#e5e7eb', text: '#4b5563', labelKey: 'tables.closed' }, // gray-200 / gray-600
};

// ─── Role Badge ────────────────────────────────────────────────

export const ROLE_BADGE_HEX: Record<string, BadgeConfig> = {
  owner: { bg: '#d1fae5', text: '#065f46', labelKey: 'owner' }, // emerald-100 / emerald-800
  admin: { bg: '#f3e8ff', text: '#6b21a8', labelKey: 'admin' }, // purple-100 / purple-800
  kitchen: { bg: '#ffedd5', text: '#9a3412', labelKey: 'kitchen' }, // orange-100 / orange-800
  waiter: { bg: '#dbeafe', text: '#1e40af', labelKey: 'waiter' }, // blue-100 / blue-800
};

// ─── Waiter Call Reason ────────────────────────────────────────

/** Single solid hex per reason (used to paint a card's left border / dot). */
export const WAITER_CALL_REASON_HEX: Record<string, string> = {
  emergency: '#ef4444',
  complaint: '#f97316',
  bill: '#10b981',
  question: '#367B8B',
  assistance: '#6b7280',
};

// ─── Mobile semantic palette ───────────────────────────────────

/**
 * Semantic palette consumed by mobile screens/components. Web equivalents
 * resolve to Tailwind utilities (e.g. `bg-red-500` for `danger`), so mobile
 * authors writing against this map land on the same visual vocabulary.
 */
export const SEMANTIC_COLORS = {
  // Backgrounds
  background: '#f8fafc',
  card: '#ffffff',

  // Text
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#6b7280',
  textLight: '#9ca3af',

  // Semantic
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Brand
  brandLight: '#e6f3f5',

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Accents
  purple: '#7c3aed',
  purpleLight: '#8b5cf6',
  indigo: '#6366f1',
  orange: '#ea580c',
} as const;
