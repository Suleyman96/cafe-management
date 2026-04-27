/**
 * Shared Status Color Maps (hex pairs)
 *
 * Single source of truth for status badge colors across web and mobile.
 * Hex values correspond exactly to the Tailwind classes used in
 * getOrderStatusColor() / getRoleBadgeColor() in utils.ts.
 */

export type StatusColorPair = { bg: string; text: string };

// ─── Order Status ──────────────────────────────────────────────

export const ORDER_STATUS_HEX: Record<string, StatusColorPair> = {
  pending_approval: { bg: '#fef3c7', text: '#92400e' }, // amber-100 / amber-800
  new: { bg: '#dbeafe', text: '#1e40af' }, // blue-100 / blue-800
  preparing: { bg: '#fef9c3', text: '#854d0e' }, // yellow-100 / yellow-800
  ready: { bg: '#dcfce7', text: '#166534' }, // green-100 / green-800
  served: { bg: '#ede9fe', text: '#6b21a8' }, // purple-100 / purple-800
  out_for_delivery: { bg: '#ede9fe', text: '#5b21b6' }, // violet-100 / violet-800
  delivered: { bg: '#d1fae5', text: '#065f46' }, // emerald-100 / emerald-800
  cancelled: { bg: '#fee2e2', text: '#991b1b' }, // red-100 / red-800
  closed: { bg: '#f3f4f6', text: '#1f2937' }, // gray-100 / gray-800
};

// ─── Table Status ──────────────────────────────────────────────

export const TABLE_STATUS_HEX: Record<string, StatusColorPair> = {
  free: { bg: '#f3f4f6', text: '#4b5563' }, // gray-100 / gray-600
  occupied: { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  reserved: { bg: '#dbeafe', text: '#1e40af' }, // blue-100 / blue-800
  closed: { bg: '#e5e7eb', text: '#4b5563' }, // gray-200 / gray-600
};

// ─── Role Badge ────────────────────────────────────────────────

export const ROLE_BADGE_HEX: Record<string, StatusColorPair> = {
  owner: { bg: '#d1fae5', text: '#065f46' }, // emerald-100 / emerald-800
  admin: { bg: '#ede9fe', text: '#6b21a8' }, // purple-100 / purple-800
  kitchen: { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  waiter: { bg: '#dbeafe', text: '#1e40af' }, // blue-100 / blue-800
};

// ─── Waiter Call Reason ────────────────────────────────────────

export const WAITER_CALL_REASON_HEX: Record<string, string> = {
  emergency: '#ef4444',
  complaint: '#f97316',
  bill: '#10b981',
  question: '#367B8B',
  assistance: '#6b7280',
};
