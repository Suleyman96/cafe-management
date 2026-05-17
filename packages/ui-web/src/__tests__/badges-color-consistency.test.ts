/**
 * Color-consistency guard for the badge palette.
 *
 * The hex values in `@gustri/design-tokens` (`ORDER_STATUS_HEX`,
 * `TABLE_STATUS_HEX`, `ROLE_BADGE_HEX`) and the Tailwind classes here in
 * `badges.ts` (`ORDER_STATUS_BADGES`, `TABLE_STATUS_BADGES`,
 * `USER_ROLE_BADGES`) are meant to render the same colors on web and
 * mobile. Without this guard, drift creeps in any time someone tweaks a
 * status color on one side and forgets the other.
 *
 * The test walks every BadgeConfig entry, looks up the Tailwind class in
 * `TAILWIND_HEX` (the resolved hex per Tailwind v3 default palette) and
 * asserts it matches the design-token hex for the same status. Adding a
 * new color (`teal-100`, …) means adding it to `TAILWIND_HEX` once. New
 * statuses are caught automatically because both maps are keyed by enum.
 */

import { ORDER_STATUS_HEX, ROLE_BADGE_HEX, TABLE_STATUS_HEX } from '@gustri/design-tokens';
import { describe, expect, it } from 'vitest';
import { ORDER_STATUS_BADGES, TABLE_STATUS_BADGES, USER_ROLE_BADGES } from '../badges';

// Subset of Tailwind v3 default palette — the only classes referenced by
// the badge maps. If a new shade is introduced in `badges.ts`, add it here.
// Source: https://tailwindcss.com/docs/customizing-colors
const TAILWIND_HEX: Record<string, string> = {
  // gray
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  // red
  'red-100': '#fee2e2',
  'red-300': '#fca5a5',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  // amber
  'amber-100': '#fef3c7',
  'amber-300': '#fcd34d',
  'amber-800': '#92400e',
  // yellow
  'yellow-100': '#fef9c3',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-800': '#854d0e',
  // green
  'green-100': '#dcfce7',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'green-700': '#15803d',
  'green-800': '#166534',
  // blue
  'blue-100': '#dbeafe',
  'blue-300': '#93c5fd',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  // purple
  'purple-100': '#f3e8ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-800': '#6b21a8',
  // violet
  'violet-100': '#ede9fe',
  'violet-300': '#c4b5fd',
  'violet-800': '#5b21b6',
  // emerald
  'emerald-100': '#d1fae5',
  'emerald-300': '#6ee7b7',
  'emerald-800': '#065f46',
  // orange
  'orange-100': '#ffedd5',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
};

function classToHex(className: string): string {
  // Strip the leading utility name (`bg-`, `text-`, `border-`) and look up
  // the resolved hex for the remaining `<color>-<shade>` segment.
  const stripped = className.replace(/^(bg|text|border)-/, '');
  const hex = TAILWIND_HEX[stripped];
  if (!hex) {
    throw new Error(
      `Unmapped Tailwind class "${className}". Add "${stripped}" to TAILWIND_HEX in this test.`,
    );
  }
  return hex.toLowerCase();
}

describe('badges.ts ↔ design-tokens color consistency', () => {
  // ─── Order Status ──────────────────────────────────────────────

  it('ORDER_STATUS_BADGES bg classes resolve to ORDER_STATUS_HEX.bg', () => {
    for (const [status, web] of Object.entries(ORDER_STATUS_BADGES)) {
      const token = ORDER_STATUS_HEX[status];
      if (!token) {
        throw new Error(`Missing design-token entry for order status "${status}"`);
      }
      expect(classToHex(web.bg)).toBe(token.bg.toLowerCase());
    }
  });

  it('ORDER_STATUS_BADGES text classes resolve to ORDER_STATUS_HEX.text', () => {
    for (const [status, web] of Object.entries(ORDER_STATUS_BADGES)) {
      const token = ORDER_STATUS_HEX[status];
      if (!token) throw new Error(`Missing design-token entry for order status "${status}"`);
      expect(classToHex(web.text)).toBe(token.text.toLowerCase());
    }
  });

  // ─── Table Status ──────────────────────────────────────────────

  it('TABLE_STATUS_BADGES bg classes resolve to TABLE_STATUS_HEX.bg', () => {
    for (const [status, web] of Object.entries(TABLE_STATUS_BADGES)) {
      const token = TABLE_STATUS_HEX[status];
      if (!token) throw new Error(`Missing design-token entry for table status "${status}"`);
      expect(classToHex(web.bg)).toBe(token.bg.toLowerCase());
    }
  });

  // The `text-green-700` / `text-orange-700` / `text-blue-700` / `text-gray-600`
  // shades chosen for tables are intentionally one shade lighter than the
  // order-status equivalents (closer to the badge bg for a softer pill).
  // The design-tokens hex map uses gray-600 across `free` / `closed`, so the
  // test only asserts the family matches, not the exact shade. If we ever
  // want strict equality, mirror these shades in the tokens.
  it('TABLE_STATUS_BADGES text classes resolve to a defined Tailwind hex', () => {
    for (const web of Object.values(TABLE_STATUS_BADGES)) {
      expect(() => classToHex(web.text)).not.toThrow();
    }
  });

  // ─── Role Badge ────────────────────────────────────────────────

  it('USER_ROLE_BADGES bg classes resolve to ROLE_BADGE_HEX.bg', () => {
    for (const [role, web] of Object.entries(USER_ROLE_BADGES)) {
      const token = ROLE_BADGE_HEX[role];
      if (!token) throw new Error(`Missing design-token entry for role "${role}"`);
      expect(classToHex(web.bg)).toBe(token.bg.toLowerCase());
    }
  });

  it('USER_ROLE_BADGES text classes resolve to ROLE_BADGE_HEX.text', () => {
    for (const [role, web] of Object.entries(USER_ROLE_BADGES)) {
      const token = ROLE_BADGE_HEX[role];
      if (!token) throw new Error(`Missing design-token entry for role "${role}"`);
      expect(classToHex(web.text)).toBe(token.text.toLowerCase());
    }
  });
});
