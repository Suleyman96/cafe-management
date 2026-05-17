/**
 * Shared Badge Config Contract + Status Color Maps
 *
 * Single source of truth for status badge styling across web and mobile.
 *
 * The `BadgeConfig` type is the shape both `@gustri/ui` (web Tailwind class
 * strings) and the mobile `StatusBadge` consume. Web values are Tailwind
 * class strings (e.g. `bg-amber-100`); mobile values are hex (e.g. `#fef3c7`).
 * Optional fields (`border`, `pulse`, `iconName`, `labelKey`) let later
 * phases add outline variants, pulse animations, and icons without diverging
 * contracts between platforms.
 *
 * Contract: every status palette here is a `BadgeConfig`-shaped record (or a
 * single solid hex only for non-badge accents like `WAITER_CALL_REASON_HEX`,
 * which paints a card's left border). Do NOT add a parallel "solid status
 * color" map here or elsewhere — an earlier `STATUS_COLORS` constant in
 * constants.ts mapped statuses to single hexes that contradicted the bg/text
 * pairs below (e.g. `new` was red as a solid, blue as a pair). It was
 * removed; do not reintroduce.
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

/**
 * Narrow alias for the bg/text pair, kept because the mobile theme re-exports
 * it as `ColorPair`. Structurally a `Pick<BadgeConfig, 'bg' | 'text'>`.
 */
export type StatusColorPair = Pick<BadgeConfig, 'bg' | 'text'>;

// ─── Order Status ──────────────────────────────────────────────

export const ORDER_STATUS_HEX: Record<string, BadgeConfig> = {
  pending_approval: { bg: '#fef3c7', text: '#92400e', labelKey: 'orders.pendingApproval' }, // amber-100 / amber-800
  new: { bg: '#dbeafe', text: '#1e40af', labelKey: 'orders.new' }, // blue-100 / blue-800
  preparing: { bg: '#fef9c3', text: '#854d0e', labelKey: 'orders.preparing' }, // yellow-100 / yellow-800
  ready: { bg: '#dcfce7', text: '#166534', labelKey: 'orders.ready' }, // green-100 / green-800
  served: { bg: '#ede9fe', text: '#6b21a8', labelKey: 'orders.served' }, // purple-100 / purple-800
  out_for_delivery: { bg: '#ede9fe', text: '#5b21b6', labelKey: 'orders.outForDelivery' }, // violet-100 / violet-800
  delivered: { bg: '#d1fae5', text: '#065f46', labelKey: 'orders.delivered' }, // emerald-100 / emerald-800
  cancelled: { bg: '#fee2e2', text: '#991b1b', labelKey: 'orders.cancelled' }, // red-100 / red-800
  closed: { bg: '#f3f4f6', text: '#1f2937', labelKey: 'orders.closed' }, // gray-100 / gray-800
};

// ─── Table Status ──────────────────────────────────────────────

export const TABLE_STATUS_HEX: Record<string, BadgeConfig> = {
  free: { bg: '#f3f4f6', text: '#4b5563', labelKey: 'tables.free' }, // gray-100 / gray-600
  occupied: { bg: '#ffedd5', text: '#9a3412', labelKey: 'tables.occupied' }, // orange-100 / orange-800
  reserved: { bg: '#dbeafe', text: '#1e40af', labelKey: 'tables.reserved' }, // blue-100 / blue-800
  closed: { bg: '#e5e7eb', text: '#4b5563', labelKey: 'tables.closed' }, // gray-200 / gray-600
};

// ─── Role Badge ────────────────────────────────────────────────

export const ROLE_BADGE_HEX: Record<string, BadgeConfig> = {
  owner: { bg: '#d1fae5', text: '#065f46', labelKey: 'owner' }, // emerald-100 / emerald-800
  admin: { bg: '#ede9fe', text: '#6b21a8', labelKey: 'admin' }, // purple-100 / purple-800
  kitchen: { bg: '#ffedd5', text: '#9a3412', labelKey: 'kitchen' }, // orange-100 / orange-800
  waiter: { bg: '#dbeafe', text: '#1e40af', labelKey: 'waiter' }, // blue-100 / blue-800
};

// ─── Waiter Call Reason ────────────────────────────────────────

export const WAITER_CALL_REASON_HEX: Record<string, string> = {
  emergency: '#ef4444',
  complaint: '#f97316',
  bill: '#10b981',
  question: '#367B8B',
  assistance: '#6b7280',
};
