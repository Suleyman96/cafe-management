/**
 * Shared border-radius scale.
 *
 * Web Tailwind classes map roughly: `rounded` = 4px, `rounded-md` = 6px,
 * `rounded-lg` = 8px, `rounded-xl` = 12px, `rounded-full` = 9999.
 */
export const RADII = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 9999,
} as const;

/** Default card container border-radius — matches Tailwind `rounded-lg`. */
export const CARD_RADIUS = RADII.lg;

/** Default card container padding — keeps web `p-3` (12px) and mobile aligned. */
export const CARD_PADDING = 12;

export type RadiusToken = keyof typeof RADII;
